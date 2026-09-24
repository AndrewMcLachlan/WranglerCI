using System.Runtime.CompilerServices;
using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Webhooks;
using Microsoft.Extensions.Logging.Abstractions;
using Octokit.Webhooks;
using Octokit.Webhooks.Events;
using Octokit.Webhooks.Events.DeploymentReview;
using Octokit.Webhooks.Events.WorkflowRun;
using Octokit.Webhooks.Extensions;
using Octokit.Webhooks.Models;
using Xunit;

namespace Wrangler.Tests;

/// <summary>
/// The webhook processor must acknowledge deliveries (return without throwing) even when a backend
/// dependency fails transiently, so a brief outage can't rack up failures and get GitHub to auto-disable
/// the webhook. The processor dispatches on <c>ProcessWebhookAsync(WebhookHeaders, WebhookEvent, ...)</c>,
/// which is exercised here directly (the event models have no public constructor and enforce required
/// JSON properties, so they're built uninitialised rather than deserialised).
/// </summary>
public class WebhookProcessingResilienceTests
{
    private static readonly WebhookHeaders Headers = new() { Event = "workflow_run", Delivery = "delivery-1" };

    [Fact]
    public async Task Delivery_is_acknowledged_when_dedupe_backend_throws()
    {
        var broadcaster = new RecordingBroadcaster();
        var processor = Processor(
            claim: () => throw new InvalidOperationException("redis unavailable"),
            broadcaster: broadcaster);

        // Must NOT throw — a throw would surface as a 5xx to GitHub and count as a failed delivery.
        await processor.ProcessWebhookAsync(Headers, WorkflowRunEvent(withRepo: false), TestContext.Current.CancellationToken);

        Assert.False(broadcaster.Published);
    }

    [Fact]
    public async Task Delivery_is_acknowledged_when_version_bump_throws()
    {
        var broadcaster = new RecordingBroadcaster();
        var processor = Processor(
            claim: () => true,
            bump: () => throw new InvalidOperationException("redis unavailable"),
            broadcaster: broadcaster);

        await processor.ProcessWebhookAsync(Headers, WorkflowRunEvent(withRepo: true), TestContext.Current.CancellationToken);

        Assert.False(broadcaster.Published);
    }

    [Fact]
    public async Task Delivery_broadcasts_normally_when_backend_is_healthy()
    {
        var broadcaster = new RecordingBroadcaster();
        var processor = Processor(claim: () => true, broadcaster: broadcaster);

        await processor.ProcessWebhookAsync(Headers, WorkflowRunEvent(withRepo: true), TestContext.Current.CancellationToken);

        Assert.True(broadcaster.Published);
    }

    // workflow_run never reports a run pausing at an environment gate, so this delivery is the only
    // way the dashboard learns a run is now waiting. Dropping it leaves the run showing as running.
    [Fact]
    public async Task Deployment_review_is_broadcast_as_its_own_event()
    {
        var broadcaster = new RecordingBroadcaster();
        var processor = Processor(claim: () => true, broadcaster: broadcaster);

        await processor.ProcessWebhookAsync(
            new WebhookHeaders { Event = "deployment_review", Delivery = "delivery-2" },
            DeploymentReviewEvent(),
            TestContext.Current.CancellationToken);

        Assert.Equal("deployment_review", broadcaster.LastType);
        Assert.Equal("owner", broadcaster.LastOwner);
        Assert.Equal("repo", broadcaster.LastRepo);
    }

    [Fact]
    public async Task Deployment_review_invalidates_the_repo_gates()
    {
        var versions = new FakeVersions(null);
        var processor = Processor(claim: () => true, versions: versions);

        await processor.ProcessWebhookAsync(
            new WebhookHeaders { Event = "deployment_review", Delivery = "delivery-3" },
            DeploymentReviewEvent(),
            TestContext.Current.CancellationToken);

        Assert.Contains(RepoDataKind.Gates, versions.Bumped);
    }

    [Fact]
    public async Task Workflow_run_invalidates_the_repo_gates()
    {
        var versions = new FakeVersions(null);
        var processor = Processor(claim: () => true, versions: versions);

        await processor.ProcessWebhookAsync(Headers, WorkflowRunEvent(withRepo: true), TestContext.Current.CancellationToken);

        Assert.Contains(RepoDataKind.Gates, versions.Bumped);
    }

    private static GitHubWebhookEventProcessor Processor(Func<bool> claim, Func<bool>? bump = null, RecordingBroadcaster? broadcaster = null, FakeVersions? versions = null) =>
        new(new FakeRegistry(claim), versions ?? new FakeVersions(bump), broadcaster ?? new RecordingBroadcaster(),
            NullLogger<GitHubWebhookEventProcessor>.Instance);

    // WorkflowRunEvent is abstract (one concrete subclass per action, with Action fixed); build the
    // concrete "completed" event uninitialised and set only the members the handler reads — once past the
    // dedupe claim, the repo and run ids.
    private static WorkflowRunEvent WorkflowRunEvent(bool withRepo)
    {
        var evt = New<WorkflowRunCompletedEvent>();
        if (withRepo)
        {
            var owner = New<User>();
            Set(owner, "Login", "owner");
            var repo = New<Repository>();
            Set(repo, "Name", "repo");
            Set(repo, "Owner", owner);
            Set(evt, "Repository", repo);

            var run = New<WorkflowRun>();
            Set(run, "Id", 10L);
            Set(run, "WorkflowId", 20L);
            // Status is required by WebhookMapping.ToRunModel (it dereferences .StringValue), so unlike
            // the other WorkflowRun members it can't stay uninitialised/null the way a real payload
            // never would.
            Set(run, "Status", new StringEnum<WorkflowRunStatus>("completed"));
            Set(evt, "WorkflowRun", run);
        }
        return evt;
    }

    private static DeploymentReviewEvent DeploymentReviewEvent()
    {
        var evt = New<DeploymentReviewRequestedEvent>();
        var owner = New<User>();
        Set(owner, "Login", "owner");
        var repo = New<Repository>();
        Set(repo, "Name", "repo");
        Set(repo, "Owner", owner);
        Set(evt, "Repository", repo);
        return evt;
    }

    private static T New<T>() => (T)RuntimeHelpers.GetUninitializedObject(typeof(T));
    private static void Set(object target, string property, object value) =>
        target.GetType().GetProperty(property)!.SetValue(target, value);

    private sealed class FakeRegistry(Func<bool> claim) : IInstallationRegistry
    {
        public Task<bool> TryClaimDeliveryAsync(string deliveryId, CancellationToken cancellationToken) => Task.FromResult(claim());
        public Task SaveInstallationAsync(long installationId, InstallationInfo info, IEnumerable<string> repos, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task RemoveInstallationAsync(long installationId, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task SetSuspendedAsync(long installationId, bool suspended, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task AddRepositoriesAsync(long installationId, IEnumerable<string> repos, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task RemoveRepositoriesAsync(long installationId, IEnumerable<string> repos, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<long?> GetInstallationIdForRepoAsync(string owner, string repo, CancellationToken cancellationToken) => Task.FromResult<long?>(null);
    }

    private sealed class FakeVersions(Func<bool>? bump) : IRepoVersionService
    {
        public List<RepoDataKind> Bumped { get; } = [];
        public Task<long> GetVersionAsync(string owner, string repo, RepoDataKind kind, CancellationToken cancellationToken) => Task.FromResult(0L);
        public Task BumpAsync(string owner, string repo, RepoDataKind kind, CancellationToken cancellationToken)
        {
            bump?.Invoke();
            Bumped.Add(kind);
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingBroadcaster : IEventBroadcaster
    {
        public bool Published { get; private set; }
        public string? LastType { get; private set; }
        public string? LastOwner { get; private set; }
        public string? LastRepo { get; private set; }
        public void Publish(GitHubEvent evt)
        {
            Published = true;
            LastType = evt.Type;
            LastOwner = evt.Owner;
            LastRepo = evt.Repo;
        }
        public EventSubscription Subscribe() => throw new NotSupportedException("The processor never subscribes.");
    }
}
