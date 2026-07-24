using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Gets a list of workflows and their latest runs for the specified repositories.
/// </summary>
public class WorkflowsQueryHandler(IDashboardService gitHubService)
    : IQueryHandler<WorkflowsRequest, IEnumerable<RepositoryModel>>
{
    public ValueTask<IEnumerable<RepositoryModel>> Handle(WorkflowsRequest query, CancellationToken cancellationToken) =>
        new(gitHubService.GetWorkflowsAsync(query, cancellationToken));
}
