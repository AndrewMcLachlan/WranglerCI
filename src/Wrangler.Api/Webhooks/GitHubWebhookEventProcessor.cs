using Octokit.Webhooks;
using Octokit.Webhooks.Events;
using Octokit.Webhooks.Events.CheckRun;
using Octokit.Webhooks.Events.CheckSuite;
using Octokit.Webhooks.Events.Installation;
using Octokit.Webhooks.Events.InstallationRepositories;
using Octokit.Webhooks.Events.PullRequest;
using Octokit.Webhooks.Events.WorkflowRun;

namespace Asm.Wrangler.Api.Webhooks;

/// <summary>
/// Receives GitHub App webhook deliveries. Phase 1: log-only with delivery dedupe,
/// plus maintain the installation registry. Cache invalidation and event broadcasting
/// arrive in later phases.
/// </summary>
internal sealed class GitHubWebhookEventProcessor(
    IInstallationRegistry registry,
    IRepoVersionService versions,
    ILogger<GitHubWebhookEventProcessor> logger) : WebhookEventProcessor
{
    // pull_request actions that change check status or PR list visibility;
    // anything else (label/assign/review_requested/...) is noise for our UI.
    private static readonly HashSet<PullRequestAction> InvalidatingPullRequestActions =
    [
        PullRequestAction.Opened,
        PullRequestAction.Closed,
        PullRequestAction.Reopened,
        PullRequestAction.Synchronize,
        PullRequestAction.Edited,
        PullRequestAction.ReadyForReview,
    ];

    protected override async ValueTask ProcessWorkflowRunWebhookAsync(WebhookHeaders headers, WorkflowRunEvent workflowRunEvent, WorkflowRunAction action, CancellationToken cancellationToken = default)
    {
        if (!await ClaimAsync(headers, cancellationToken)) return;
        var (owner, repo) = RepoOf(workflowRunEvent.Repository);
        logger.LogInformation("workflow_run.{Action} {Owner}/{Repo} run={RunId}", action, owner, repo, workflowRunEvent.WorkflowRun.Id);
        await BumpAsync(owner, repo, RepoDataKind.WorkflowRuns, cancellationToken);
        await BumpAsync(owner, repo, RepoDataKind.Workflows, cancellationToken);
    }

    protected override async ValueTask ProcessPullRequestWebhookAsync(WebhookHeaders headers, PullRequestEvent pullRequestEvent, PullRequestAction action, CancellationToken cancellationToken = default)
    {
        if (!await ClaimAsync(headers, cancellationToken)) return;
        var (owner, repo) = RepoOf(pullRequestEvent.Repository);
        logger.LogInformation("pull_request.{Action} {Owner}/{Repo} #{Number}", action, owner, repo, pullRequestEvent.PullRequest.Number);
        if (InvalidatingPullRequestActions.Contains(action))
        {
            await BumpAsync(owner, repo, RepoDataKind.Pulls, cancellationToken);
        }
    }

    protected override async ValueTask ProcessCheckRunWebhookAsync(WebhookHeaders headers, CheckRunEvent checkRunEvent, CheckRunAction action, CancellationToken cancellationToken = default)
    {
        if (!await ClaimAsync(headers, cancellationToken)) return;
        var (owner, repo) = RepoOf(checkRunEvent.Repository);
        logger.LogInformation("check_run.{Action} {Owner}/{Repo} name={Name}", action, owner, repo, checkRunEvent.CheckRun.Name);
        await BumpAsync(owner, repo, RepoDataKind.Checks, cancellationToken);
        await BumpAsync(owner, repo, RepoDataKind.WorkflowRuns, cancellationToken);
    }

    protected override async ValueTask ProcessCheckSuiteWebhookAsync(WebhookHeaders headers, CheckSuiteEvent checkSuiteEvent, CheckSuiteAction action, CancellationToken cancellationToken = default)
    {
        if (!await ClaimAsync(headers, cancellationToken)) return;
        var (owner, repo) = RepoOf(checkSuiteEvent.Repository);
        logger.LogInformation("check_suite.{Action} {Owner}/{Repo} id={Id}", action, owner, repo, checkSuiteEvent.CheckSuite.Id);
        await BumpAsync(owner, repo, RepoDataKind.Checks, cancellationToken);
        await BumpAsync(owner, repo, RepoDataKind.WorkflowRuns, cancellationToken);
    }

    private async ValueTask BumpAsync(string? owner, string? repo, RepoDataKind kind, CancellationToken cancellationToken)
    {
        if (String.IsNullOrEmpty(owner) || String.IsNullOrEmpty(repo)) return;
        await versions.BumpAsync(owner, repo, kind, cancellationToken);
    }

    private static (string? Owner, string? Repo) RepoOf(Octokit.Webhooks.Models.Repository? repository) =>
        (repository?.Owner.Login, repository?.Name);

    protected override async ValueTask ProcessInstallationWebhookAsync(WebhookHeaders headers, InstallationEvent installationEvent, InstallationAction action, CancellationToken cancellationToken = default)
    {
        if (!await ClaimAsync(headers, cancellationToken)) return;

        var installation = installationEvent.Installation;
        var info = new InstallationInfo
        {
            Account = installation.Account.Login,
            AccountId = (long)installation.Account.Id,
            Type = installation.Account.Type?.ToString() ?? "User",
        };
        var repos = installationEvent.Repositories?.Select(r => r.FullName) ?? [];

        if (action == InstallationAction.Created)
        {
            await registry.SaveInstallationAsync((long)installation.Id, info, repos, cancellationToken);
            logger.LogInformation("installation.created id={Id} account={Account}", installation.Id, info.Account);
        }
        else if (action == InstallationAction.Deleted)
        {
            await registry.RemoveInstallationAsync((long)installation.Id, cancellationToken);
            logger.LogInformation("installation.deleted id={Id}", installation.Id);
        }
        else if (action == InstallationAction.Suspend)
        {
            await registry.SetSuspendedAsync((long)installation.Id, suspended: true, cancellationToken);
            logger.LogInformation("installation.suspend id={Id}", installation.Id);
        }
        else if (action == InstallationAction.Unsuspend)
        {
            await registry.SetSuspendedAsync((long)installation.Id, suspended: false, cancellationToken);
            logger.LogInformation("installation.unsuspend id={Id}", installation.Id);
        }
        else
        {
            logger.LogInformation("installation.{Action} id={Id} (no-op)", action, installation.Id);
        }
    }

    protected override async ValueTask ProcessInstallationRepositoriesWebhookAsync(WebhookHeaders headers, InstallationRepositoriesEvent installationRepositoriesEvent, InstallationRepositoriesAction action, CancellationToken cancellationToken = default)
    {
        if (!await ClaimAsync(headers, cancellationToken)) return;

        var installationId = (long)installationRepositoriesEvent.Installation.Id;

        if (action == InstallationRepositoriesAction.Added)
        {
            var added = installationRepositoriesEvent.RepositoriesAdded?.Select(r => r.FullName) ?? [];
            await registry.AddRepositoriesAsync(installationId, added, cancellationToken);
            logger.LogInformation("installation_repositories.added id={Id} count={Count}", installationId, added.Count());
        }
        else if (action == InstallationRepositoriesAction.Removed)
        {
            var removed = installationRepositoriesEvent.RepositoriesRemoved?.Select(r => r.FullName) ?? [];
            await registry.RemoveRepositoriesAsync(installationId, removed, cancellationToken);
            logger.LogInformation("installation_repositories.removed id={Id} count={Count}", installationId, removed.Count());
        }
    }

    private async ValueTask<bool> ClaimAsync(WebhookHeaders headers, CancellationToken cancellationToken)
    {
        var deliveryId = headers.Delivery;
        if (String.IsNullOrEmpty(deliveryId)) return true;

        var first = await registry.TryClaimDeliveryAsync(deliveryId, cancellationToken);
        if (!first)
        {
            logger.LogDebug("Duplicate webhook delivery {DeliveryId} ignored.", deliveryId);
        }
        return first;
    }
}
