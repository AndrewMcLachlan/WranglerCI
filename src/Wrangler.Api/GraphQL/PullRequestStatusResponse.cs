using Asm.Wrangler.Api.Models.PullRequests;

namespace Asm.Wrangler.Api.GraphQL;

/// <summary>
/// The merge-readiness GitHub reports for one pull request.
/// </summary>
internal record PullRequestStatus(int UnresolvedThreads, ReviewDecision? ReviewDecision, MergeState? MergeState);

/// <summary>
/// The response to <see cref="Query"/>, shaped for Octokit's serializer.
/// </summary>
internal class PullRequestStatusResponse
{
    // Fields must be aliased to snake_case: Octokit's serializer binds no other casing.
    public const string Query = "query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { pull_requests: pullRequests(states: OPEN, first: 100) { nodes { number review_decision: reviewDecision merge_state_status: mergeStateStatus review_threads: reviewThreads(first: 100) { nodes { is_resolved: isResolved } } } } } }";

    public PullRequestStatusData? Data { get; set; }

    /// <summary>
    /// The status of each open pull request, by number.
    /// </summary>
    public IReadOnlyDictionary<int, PullRequestStatus> ByNumber() =>
        (Data?.Repository?.PullRequests?.Nodes ?? []).ToDictionary(pr => pr.Number, pr => pr.ToStatus());
}

internal class PullRequestStatusData
{
    public PullRequestStatusRepository? Repository { get; set; }
}

internal class PullRequestStatusRepository
{
    public PullRequestStatusConnection<PullRequestStatusNode>? PullRequests { get; set; }

    public PullRequestStatusNode? PullRequest { get; set; }
}

internal class PullRequestStatusConnection<T>
{
    public List<T>? Nodes { get; set; }
}

internal class PullRequestStatusNode
{
    public int Number { get; set; }

    public PullRequestAuthor? Author { get; set; }

    public string? ReviewDecision { get; set; }

    public string? MergeStateStatus { get; set; }

    public PullRequestStatusConnection<ReviewThread>? ReviewThreads { get; set; }

    public PullRequestStatus ToStatus() => new(
        (ReviewThreads?.Nodes ?? []).Count(t => !t.IsResolved),
        ParseEnum<ReviewDecision>(ReviewDecision),
        ParseEnum<MergeState>(MergeStateStatus));

    // GitHub sends SCREAMING_SNAKE_CASE values, such as CHANGES_REQUESTED.
    private static T? ParseEnum<T>(string? value) where T : struct, Enum =>
        Enum.TryParse<T>(value?.Replace("_", String.Empty), ignoreCase: true, out var parsed) ? parsed : null;
}

internal class PullRequestAuthor
{
    public string? Login { get; set; }
}

internal class ReviewThread
{
    public bool IsResolved { get; set; }
}

/// <summary>
/// The response to <see cref="Query"/>: what deciding whether to approve before merging needs.
/// </summary>
internal class MergeContextResponse
{
    public const string Query = "query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pull_request: pullRequest(number: $number) { number author { login } review_decision: reviewDecision } } }";

    public PullRequestStatusData? Data { get; set; }
}
