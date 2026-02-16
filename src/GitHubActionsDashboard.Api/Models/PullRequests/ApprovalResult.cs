namespace GitHubActionsDashboard.Api.Models.PullRequests;

/// <summary>
/// The result of an approve-and-merge operation for a single pull request.
/// </summary>
public record ApprovalResult
{
    /// <summary>
    /// The owner (user or organisation) of the repository.
    /// </summary>
    public required string RepositoryOwner { get; init; }

    /// <summary>
    /// The name of the repository.
    /// </summary>
    public required string RepositoryName { get; init; }

    /// <summary>
    /// The pull request number within the repository.
    /// </summary>
    public required int PullRequestNumber { get; init; }

    /// <summary>
    /// Whether the pull request was successfully approved.
    /// </summary>
    public required bool Approved { get; init; }

    /// <summary>
    /// Whether the pull request was successfully merged.
    /// </summary>
    public required bool Merged { get; init; }

    /// <summary>
    /// The error message if approval or merge failed; <c>null</c> on success.
    /// </summary>
    public string? Error { get; init; }
}
