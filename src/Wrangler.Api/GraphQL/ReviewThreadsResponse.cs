namespace Asm.Wrangler.Api.GraphQL;

/// <summary>
/// The response to <see cref="Query"/>, shaped for Octokit's serializer.
/// </summary>
internal class ReviewThreadsResponse
{
    // Fields must be aliased to snake_case: Octokit's serializer binds no other casing.
    public const string Query = "query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { pull_requests: pullRequests(states: OPEN, first: 100) { nodes { number review_threads: reviewThreads(first: 100) { nodes { is_resolved: isResolved } } } } } }";

    public ReviewThreadsData? Data { get; set; }

    /// <summary>
    /// Unresolved review threads per open pull request number.
    /// </summary>
    public IReadOnlyDictionary<int, int> UnresolvedByNumber() =>
        (Data?.Repository?.PullRequests?.Nodes ?? []).ToDictionary(pr => pr.Number, pr => (pr.ReviewThreads?.Nodes ?? []).Count(t => !t.IsResolved));
}

internal class ReviewThreadsData
{
    public ReviewThreadsRepository? Repository { get; set; }
}

internal class ReviewThreadsRepository
{
    public ReviewThreadsConnection<ReviewThreadsPullRequest>? PullRequests { get; set; }
}

internal class ReviewThreadsConnection<T>
{
    public List<T>? Nodes { get; set; }
}

internal class ReviewThreadsPullRequest
{
    public int Number { get; set; }

    public ReviewThreadsConnection<ReviewThread>? ReviewThreads { get; set; }
}

internal class ReviewThread
{
    public bool IsResolved { get; set; }
}
