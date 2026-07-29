using System.Runtime.CompilerServices;
using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Webhooks;
using Xunit;
using WUser = Octokit.Webhooks.Models.User;
using WWorkflowRun = Octokit.Webhooks.Models.WorkflowRun;
using WPullRequest = Octokit.Webhooks.Models.PullRequestEvent.PullRequest;
using WPullRequestHead = Octokit.Webhooks.Models.PullRequestEvent.PullRequestHead;
using WPullRequestBase = Octokit.Webhooks.Models.PullRequestEvent.PullRequestBase;

namespace Wrangler.Tests;

/// <summary>
/// Pure payload-to-model mapping: no I/O, no GitHub API call. The webhook models have no public
/// constructor and enforce required JSON properties, so they're built uninitialised via
/// <see cref="RuntimeHelpers.GetUninitializedObject"/> and populated by reflection, as established in
/// <see cref="WebhookProcessingResilienceTests"/>.
/// </summary>
public class WebhookMappingTests
{
    [Fact]
    public void ToRunModel_carries_every_field()
    {
        var actor = New<WUser>();
        Set(actor, "Name", "Ada Lovelace");
        Set(actor, "Login", "ada");

        var createdAt = DateTimeOffset.Parse("2026-07-25T10:00:00Z");
        var updatedAt = DateTimeOffset.Parse("2026-07-25T10:05:00Z");

        var run = New<WWorkflowRun>();
        Set(run, "Id", 111L);
        Set(run, "WorkflowId", 222L);
        Set(run, "NodeId", "WR_node_1");
        Set(run, "HeadBranch", "feature/stream-push-updates");
        Set(run, "Event", "push");
        Set(run, "RunNumber", 42L);
        Set(run, "Status", MakeWebhooksStringEnum<Octokit.Webhooks.Models.WorkflowRunStatus>("completed"));
        Set(run, "Conclusion", MakeWebhooksStringEnum<Octokit.Webhooks.Models.WorkflowRunConclusion>("failure"));
        Set(run, "TriggeringActor", actor);
        Set(run, "CreatedAt", createdAt);
        Set(run, "UpdatedAt", updatedAt);
        Set(run, "HtmlUrl", "https://github.com/owner/repo/actions/runs/111");

        var model = WebhookMapping.ToRunModel(run);

        Assert.Equal(111L, model.Id);
        Assert.Equal(222L, model.WorkflowId);
        Assert.Equal("WR_node_1", model.NodeId);
        Assert.Equal("feature/stream-push-updates", model.HeadBranch);
        Assert.Equal("push", model.Event);
        Assert.Equal(42L, model.RunNumber);
        Assert.Equal("completed", model.Status.StringValue);
        Assert.Equal(Octokit.WorkflowRunStatus.Completed, model.Status.Value);
        Assert.NotNull(model.Conclusion);
        Assert.Equal("failure", model.Conclusion!.Value.StringValue);
        Assert.Equal(Octokit.WorkflowRunConclusion.Failure, model.Conclusion.Value.Value);
        Assert.Equal("Ada Lovelace", model.TriggeringActor);
        Assert.Equal(createdAt, model.CreatedAt);
        Assert.Equal(updatedAt, model.UpdatedAt);
        Assert.Equal("https://github.com/owner/repo/actions/runs/111", model.HtmlUrl);

        // Derived RAG status: Conclusion "failure" -> Red, regardless of Status.
        Assert.Equal(WorkflowStatus.Red, model.WorkflowStatus);
    }

    [Fact]
    public void ToRunModel_derives_Running_when_in_progress_with_no_conclusion()
    {
        var run = New<WWorkflowRun>();
        Set(run, "Id", 1L);
        Set(run, "WorkflowId", 2L);
        Set(run, "NodeId", "WR_node_2");
        Set(run, "HeadBranch", "main");
        Set(run, "Event", "push");
        Set(run, "RunNumber", 1L);
        Set(run, "Status", MakeWebhooksStringEnum<Octokit.Webhooks.Models.WorkflowRunStatus>("in_progress"));
        Set(run, "Conclusion", null!);
        Set(run, "CreatedAt", DateTimeOffset.UtcNow);
        Set(run, "UpdatedAt", DateTimeOffset.UtcNow);
        Set(run, "HtmlUrl", "https://github.com/owner/repo/actions/runs/1");

        var model = WebhookMapping.ToRunModel(run);

        Assert.Null(model.Conclusion);
        Assert.Equal(Octokit.WorkflowRunStatus.InProgress, model.Status.Value);
        Assert.Equal(WorkflowStatus.Running, model.WorkflowStatus);
    }

    [Fact]
    public void ToRunModel_falls_back_to_login_when_triggering_actor_has_no_name()
    {
        var actor = New<WUser>();
        Set(actor, "Login", "octocat");

        var run = New<WWorkflowRun>();
        Set(run, "Id", 1L);
        Set(run, "WorkflowId", 2L);
        Set(run, "NodeId", "WR_node_3");
        Set(run, "HeadBranch", "main");
        Set(run, "Event", "push");
        Set(run, "RunNumber", 1L);
        Set(run, "Status", MakeWebhooksStringEnum<Octokit.Webhooks.Models.WorkflowRunStatus>("queued"));
        Set(run, "TriggeringActor", actor);
        Set(run, "CreatedAt", DateTimeOffset.UtcNow);
        Set(run, "UpdatedAt", DateTimeOffset.UtcNow);
        Set(run, "HtmlUrl", "https://github.com/owner/repo/actions/runs/1");

        var model = WebhookMapping.ToRunModel(run);

        Assert.Equal("octocat", model.TriggeringActor);
    }

    [Fact]
    public void ToPullRequestMetadata_carries_every_field()
    {
        var author = New<WUser>();
        Set(author, "Login", "octocat");

        var head = New<WPullRequestHead>();
        Set(head, "Sha", "abc123");
        Set(head, "Ref", "feature/thing");

        var baseRef = New<WPullRequestBase>();
        Set(baseRef, "Sha", "def456");
        Set(baseRef, "Ref", "main");

        var createdAt = DateTimeOffset.Parse("2026-07-20T08:00:00Z");
        var updatedAt = DateTimeOffset.Parse("2026-07-21T09:00:00Z");

        var pr = New<WPullRequest>();
        Set(pr, "Id", 999L);
        Set(pr, "Number", 17L);
        Set(pr, "NodeId", "PR_node_1");
        Set(pr, "Title", "Add stream push updates");
        Set(pr, "User", author);
        Set(pr, "HtmlUrl", "https://github.com/owner/repo/pull/17");
        Set(pr, "Head", head);
        Set(pr, "Base", baseRef);
        Set(pr, "CreatedAt", createdAt);
        Set(pr, "UpdatedAt", updatedAt);
        Set(pr, "State", MakeWebhooksStringEnum<Octokit.Webhooks.Models.PullRequestEvent.PullRequestState>("open"));

        var data = WebhookMapping.ToPullRequestMetadata(pr, "owner", "repo");

        Assert.Equal(999L, data.Id);
        Assert.Equal(17, data.Number);
        Assert.Equal("PR_node_1", data.NodeId);
        Assert.Equal("Add stream push updates", data.Title);
        Assert.Equal("octocat", data.Author);
        Assert.Equal("owner", data.RepositoryOwner);
        Assert.Equal("repo", data.RepositoryName);
        Assert.Equal("https://github.com/owner/repo/pull/17", data.HtmlUrl);
        Assert.Equal("abc123", data.HeadSha);
        Assert.Equal("feature/thing", data.HeadRef);
        Assert.Equal(createdAt, data.CreatedAt);
        Assert.Equal(updatedAt, data.UpdatedAt);
        Assert.Equal("open", data.State);
    }

    private static T New<T>() => (T)RuntimeHelpers.GetUninitializedObject(typeof(T));

    private static void Set(object target, string property, object value) =>
        target.GetType().GetProperty(property)!.SetValue(target, value);

    // The webhooks Octokit.Webhooks.Extensions.StringEnum<T> has no public parameterless ctor path here
    // (it's internal to the Octokit.Webhooks.Extensions namespace but its members are public); use its
    // public (string) constructor directly like real deserialisation would.
    private static Octokit.Webhooks.Extensions.StringEnum<T> MakeWebhooksStringEnum<T>(string token)
        where T : struct, Enum =>
        new(token);
}
