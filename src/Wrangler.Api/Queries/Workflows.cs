using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Queries;

/// <summary>Retrieves workflows and their latest runs for the specified repositories.</summary>
public record Workflows : BranchFilterRequest, IQuery<IEnumerable<RepositoryModel>>
{
    /// <summary>A repository with the specific workflow IDs to include.</summary>
    public record RepositoryWorkflowRequest
    {
        /// <summary>The repository owner (user or organisation login).</summary>
        public required string Owner { get; init; }

        /// <summary>The repository name.</summary>
        public required string Name { get; init; }

        /// <summary>The workflow IDs to include from this repository.</summary>
        public IReadOnlyList<long> Workflows { get; init; } = [];
    }

    /// <summary>The repositories and their workflows to query.</summary>
    public IReadOnlyList<RepositoryWorkflowRequest> Repositories { get; init; } = [];
}

internal class WorkflowsHandler(IDashboardService gitHubService) : IQueryHandler<Workflows, IEnumerable<RepositoryModel>>
{
    public ValueTask<IEnumerable<RepositoryModel>> Handle(Workflows query, CancellationToken cancellationToken) =>
        new(gitHubService.GetWorkflowsAsync(query, cancellationToken));
}
