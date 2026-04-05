namespace Asm.Wrangler.Api.Requests;

/// <summary>
/// Request to retrieve workflows and their latest runs for the specified repositories.
/// </summary>
public record WorkflowsRequest : BranchFilterRequest
{
    /// <summary>
    /// A repository with the specific workflow IDs to include.
    /// </summary>
    public record RepositoryWorkflowRequest
    {
        /// <summary>
        /// The repository owner (user or organisation login).
        /// </summary>
        public required string Owner { get; init; }

        /// <summary>
        /// The repository name.
        /// </summary>
        public required string Name { get; init; }

        /// <summary>
        /// The workflow IDs to include from this repository.
        /// </summary>
        public IReadOnlyList<long> Workflows { get; init; } = [];
    }

    /// <summary>
    /// The repositories and their workflows to query.
    /// </summary>
    public IReadOnlyList<RepositoryWorkflowRequest> Repositories { get; init; } = [];
}
