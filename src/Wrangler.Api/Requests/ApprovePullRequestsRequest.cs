namespace Asm.Wrangler.Api.Requests;

/// <summary>
/// Request to approve and merge a batch of pull requests.
/// </summary>
public record ApprovePullRequestsRequest
{
    /// <summary>
    /// Identifies a single pull request by repository and number.
    /// </summary>
    public record PullRequestReference
    {
        /// <summary>
        /// The repository owner (user or organisation login).
        /// </summary>
        public required string Owner { get; init; }

        /// <summary>
        /// The repository name.
        /// </summary>
        public required string Repo { get; init; }

        /// <summary>
        /// The pull request number.
        /// </summary>
        public required int Number { get; init; }
    }

    /// <summary>
    /// The pull requests to approve and merge.
    /// </summary>
    public IReadOnlyList<PullRequestReference> PullRequests { get; init; } = [];
}
