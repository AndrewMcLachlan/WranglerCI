namespace Asm.Wrangler.Api.Models.PullRequests;

/// <summary>
/// A label applied to a pull request, with the colour GitHub stores against it.
/// </summary>
public record PullRequestLabel
{
    /// <summary>The label name.</summary>
    public required string Name { get; init; }

    /// <summary>The label colour as a six-character hex string, no leading "#".</summary>
    public required string Color { get; init; }
}

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

    /// <summary>
    /// The number of review conversations not yet resolved, which block merge where the branch requires conversation resolution.
    /// <c>null</c> when GitHub could not report them.
    /// </summary>
    public int? UnresolvedThreads { get; init; }

    /// <summary>
    /// Where the pull request stands against the branch's review requirements.
    /// <c>null</c> when no review is required, or GitHub could not report it.
    /// </summary>
    public ReviewDecision? ReviewDecision { get; init; }

    /// <summary>
    /// GitHub's view of whether the pull request can be merged now.
    /// <c>null</c> when GitHub could not report it.
    /// </summary>
    public MergeState? MergeState { get; init; }

    /// <summary>
    /// What stops Wrangler merging the pull request for the current user. Empty when nothing does, or GitHub could not report it.
    /// </summary>
    public IReadOnlyList<MergeBlocker> Blockers { get; init; } = [];

    /// <summary>
    /// The labels applied to the pull request, in the order GitHub returns them.
    /// </summary>
    public IReadOnlyList<PullRequestLabel> Labels { get; init; } = [];
}
