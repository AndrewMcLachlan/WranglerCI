using Asm.Wrangler.Api.Models.Dashboard;
using Octokit;
using WWorkflowRun = Octokit.Webhooks.Models.WorkflowRun;
using WPullRequest = Octokit.Webhooks.Models.PullRequestEvent.PullRequest;

namespace Asm.Wrangler.Api.Webhooks;

/// <summary>
/// Metadata about a pull request carried entirely by a webhook payload, with NO GitHub API call.
/// Deliberately excludes check/CI status: that isn't present on the <c>pull_request</c> payload and
/// is tracked separately via workflow-run events.
/// </summary>
public record PullRequestEventData(
    long Id,
    int Number,
    string NodeId,
    string Title,
    string Author,
    string RepositoryOwner,
    string RepositoryName,
    string HtmlUrl,
    string HeadSha,
    string HeadRef,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string State);

/// <summary>
/// Pure payload-to-model mappers for GitHub webhook deliveries. The webhook delivery already contains
/// the changed entity in full, so these map it directly to the models the UI renders — no GitHub API
/// call, no I/O, easy to unit test.
/// </summary>
public static class WebhookMapping
{
    /// <summary>
    /// Maps a webhook <see cref="WWorkflowRun"/> to the dashboard <see cref="WorkflowRunModel"/>.
    /// </summary>
    /// <remarks>
    /// The webhook payload's <c>Conclusion</c>/<c>Status</c> are <c>Octokit.Webhooks</c>
    /// <c>StringEnum&lt;T&gt;</c> (a reference type) values; the target model uses Octokit's own
    /// <c>StringEnum&lt;T&gt;</c> (a value type). Both expose the raw GitHub API token via
    /// <c>StringValue</c> (e.g. "failure", "in_progress"), and Octokit's <c>StringEnum&lt;T&gt;</c>
    /// has a <c>(string)</c> constructor that parses that same token — so the token is carried across
    /// verbatim via <c>StringValue</c>, verified by reflecting the installed DLLs.
    /// </remarks>
    public static WorkflowRunModel ToRunModel(WWorkflowRun run) => new()
    {
        Id = run.Id,
        WorkflowId = run.WorkflowId,
        NodeId = run.NodeId,
        // NB: the null branch must be cast to the nullable struct type explicitly. Octokit.StringEnum<T>
        // declares an implicit `string -> StringEnum<T>` conversion operator, so an un-cast `null` here
        // resolves through "null -> string -> StringEnum<T>" (one predefined + one user-defined
        // conversion, which the C# spec allows), calling the (string) constructor with a null argument
        // and throwing ArgumentNullException instead of producing a null StringEnum<T>?.
        Conclusion = run.Conclusion is null
            ? (StringEnum<WorkflowRunConclusion>?)null
            : new StringEnum<WorkflowRunConclusion>(run.Conclusion.StringValue),
        Status = new StringEnum<WorkflowRunStatus>(run.Status.StringValue),
        HeadBranch = run.HeadBranch,
        Event = run.Event,
        RunNumber = run.RunNumber,
        TriggeringActor = run.TriggeringActor?.Name ?? run.TriggeringActor?.Login,
        CreatedAt = run.CreatedAt,
        UpdatedAt = run.UpdatedAt,
        HtmlUrl = run.HtmlUrl,
    };

    /// <summary>
    /// Maps a webhook <see cref="WPullRequest"/> to <see cref="PullRequestEventData"/>. The repository
    /// owner/name aren't on the PR payload itself (they're on the enclosing webhook event's repository),
    /// so they're supplied by the caller.
    /// </summary>
    public static PullRequestEventData ToPullRequestMetadata(WPullRequest pr, string owner, string repo) => new(
        Id: pr.Id,
        Number: (int)pr.Number,
        NodeId: pr.NodeId,
        Title: pr.Title,
        Author: pr.User.Login,
        RepositoryOwner: owner,
        RepositoryName: repo,
        HtmlUrl: pr.HtmlUrl,
        HeadSha: pr.Head.Sha,
        HeadRef: pr.Head.Ref,
        CreatedAt: pr.CreatedAt,
        UpdatedAt: pr.UpdatedAt,
        State: pr.State.StringValue);
}
