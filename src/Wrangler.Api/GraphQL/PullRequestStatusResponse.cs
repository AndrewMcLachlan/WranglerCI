using Asm.Wrangler.Api.Models.PullRequests;

namespace Asm.Wrangler.Api.GraphQL;

/// <summary>
/// The merge-readiness GitHub reports for one pull request.
/// </summary>
internal record PullRequestStatus(int UnresolvedThreads, ReviewDecision? ReviewDecision, MergeState? MergeState, CheckStatus CheckStatus, bool AutoMerge = false);

/// <summary>
/// The response to <see cref="Query"/>, shaped for Octokit's serializer.
/// </summary>
internal class PullRequestStatusResponse
{
    // Fields must be aliased to snake_case: Octokit's serializer binds no other casing.
    // Pages must stay small: GitHub times out (502/504) on large repos at 100 per page.
    public const string Query = "query($owner: String!, $name: String!, $cursor: String) { repository(owner: $owner, name: $name) { pull_requests: pullRequests(states: OPEN, first: 25, after: $cursor) { page_info: pageInfo { has_next_page: hasNextPage end_cursor: endCursor } nodes { number review_decision: reviewDecision merge_state_status: mergeStateStatus auto_merge_request: autoMergeRequest { enabled_at: enabledAt } review_threads: reviewThreads(first: 100) { nodes { is_resolved: isResolved } } commits(last: 1) { nodes { commit { status_check_rollup: statusCheckRollup { state } } } } } } } }";

    public PullRequestStatusData? Data { get; set; }

    /// <summary>
    /// The status of each open pull request, by number.
    /// </summary>
    public IReadOnlyDictionary<int, PullRequestStatus> ByNumber() =>
        (Data?.Repository?.PullRequests?.Nodes ?? []).ToDictionary(pr => pr.Number, pr => pr.ToStatus());

    /// <summary>
    /// Where the next page of open pull requests starts, or <see langword="null"/> on the last page.
    /// </summary>
    public string? NextCursor => Data?.Repository?.PullRequests?.PageInfo is { HasNextPage: true } pageInfo ? pageInfo.EndCursor : null;
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
    public PageInfo? PageInfo { get; set; }

    public List<T>? Nodes { get; set; }
}

internal class PageInfo
{
    public bool HasNextPage { get; set; }

    public string? EndCursor { get; set; }
}

internal class PullRequestStatusNode
{
    public string? Id { get; set; }

    public int Number { get; set; }

    public PullRequestAuthor? Author { get; set; }

    public string? ReviewDecision { get; set; }

    public string? MergeStateStatus { get; set; }

    public PullRequestStatusConnection<ReviewThread>? ReviewThreads { get; set; }

    public PullRequestStatusConnection<HeadCommitNode>? Commits { get; set; }

    public AutoMergeRequest? AutoMergeRequest { get; set; }

    public PullRequestStatus ToStatus() => new(
        (ReviewThreads?.Nodes ?? []).Count(t => !t.IsResolved),
        ParseEnum<ReviewDecision>(ReviewDecision),
        ParseEnum<MergeState>(MergeStateStatus),
        CheckStatusOf(Commits?.Nodes?.LastOrDefault()?.Commit),
        AutoMergeRequest is not null);

    // A head commit with no rollup has no checks or statuses at all, which counts as passing.
    private static CheckStatus CheckStatusOf(HeadCommit? commit) => commit is null ? CheckStatus.Unknown : commit.StatusCheckRollup?.State switch
    {
        null or "SUCCESS" => CheckStatus.Success,
        "FAILURE" or "ERROR" => CheckStatus.Failure,
        _ => CheckStatus.Pending,
    };

    // GitHub sends SCREAMING_SNAKE_CASE values, such as CHANGES_REQUESTED.
    private static T? ParseEnum<T>(string? value) where T : struct, Enum =>
        Enum.TryParse<T>(value?.Replace("_", String.Empty), ignoreCase: true, out var parsed) ? parsed : null;
}

internal class HeadCommitNode
{
    public HeadCommit? Commit { get; set; }
}

internal class HeadCommit
{
    public StatusCheckRollup? StatusCheckRollup { get; set; }
}

internal class StatusCheckRollup
{
    public string? State { get; set; }
}

internal class AutoMergeRequest
{
    public DateTimeOffset? EnabledAt { get; set; }
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
/// The response to <see cref="Query"/>: what deciding whether to approve, merge now or enable auto-merge needs.
/// </summary>
internal class MergeContextResponse
{
    public const string Query = "query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pull_request: pullRequest(number: $number) { id number author { login } review_decision: reviewDecision merge_state_status: mergeStateStatus auto_merge_request: autoMergeRequest { enabled_at: enabledAt } } } }";

    public PullRequestStatusData? Data { get; set; }
}

/// <summary>
/// The response to <see cref="Mutation"/>, which enables auto-merge on one pull request.
/// </summary>
internal class EnableAutoMergeResponse
{
    public const string Mutation = "mutation($id: ID!, $method: PullRequestMergeMethod!) { enable_pull_request_auto_merge: enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { client_mutation_id: clientMutationId } }";

    public List<GraphQLError>? Errors { get; set; }
}

internal class GraphQLError
{
    public string? Message { get; set; }
}
