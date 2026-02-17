namespace GitHubActionsDashboard.Api.Models.PullRequests;

/// <summary>
/// Represents an open pull request with its aggregated check status.
/// </summary>
public record PullRequestModel
{
    /// <summary>
    /// The GitHub database ID of the pull request.
    /// </summary>
    public required long Id { get; init; }

    /// <summary>
    /// The pull request number within the repository.
    /// </summary>
    public required int Number { get; init; }

    /// <summary>
    /// The GraphQL node ID.
    /// </summary>
    public required string NodeId { get; init; }

    /// <summary>
    /// The pull request title.
    /// </summary>
    public required string Title { get; init; }

    /// <summary>
    /// The login of the user who created the pull request.
    /// </summary>
    public required string Author { get; init; }

    /// <summary>
    /// The owner (user or organisation) of the repository.
    /// </summary>
    public required string RepositoryOwner { get; init; }

    /// <summary>
    /// The name of the repository.
    /// </summary>
    public required string RepositoryName { get; init; }

    /// <summary>
    /// The URL to view the pull request on GitHub.
    /// </summary>
    public required string HtmlUrl { get; init; }

    /// <summary>
    /// The SHA of the head commit.
    /// </summary>
    public required string HeadSha { get; init; }

    /// <summary>
    /// The name of the head branch.
    /// </summary>
    public required string HeadRef { get; init; }

    /// <summary>
    /// When the pull request was created.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>
    /// When the pull request was last updated.
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; init; }

    /// <summary>
    /// The aggregated check status for the head commit.
    /// </summary>
    public required CheckStatus CheckStatus { get; init; }
}
