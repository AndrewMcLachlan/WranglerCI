namespace GitHubActionsDashboard.Api.Requests;

/// <summary>
/// Request to retrieve open pull requests from the specified repositories, filtered by author.
/// </summary>
public record PullRequestsRequest
{
    /// <summary>
    /// A repository identified by owner and name.
    /// </summary>
    public record RepositoryRequest
    {
        /// <summary>
        /// The repository owner (user or organisation login).
        /// </summary>
        public required string Owner { get; init; }

        /// <summary>
        /// The repository name.
        /// </summary>
        public required string Name { get; init; }
    }

    /// <summary>
    /// The repositories to search for open pull requests.
    /// </summary>
    public IReadOnlyList<RepositoryRequest> Repositories { get; init; } = [];

    /// <summary>
    /// The author logins to filter by (case-insensitive).
    /// </summary>
    public IReadOnlyList<string> Authors { get; init; } = [];
}
