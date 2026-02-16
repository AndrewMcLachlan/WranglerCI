using GitHubActionsDashboard.Api.Models.Dashboard;
using GitHubActionsDashboard.Api.Requests;
using GitHubActionsDashboard.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GitHubActionsDashboard.Api.Handlers;

/// <summary>
/// Gets a list of workflows and their latest runs for the specified repositories.
/// </summary>
public static class WorkflowsHandler
{
    /// <summary>
    /// Retrieves workflows and their latest runs for the specified repositories.
    /// </summary>
    public static Task<IEnumerable<RepositoryModel>> Handle([FromServices] IDashboardService gitHubService, [FromBody] WorkflowsRequest request, CancellationToken cancellationToken) => gitHubService.GetWorkflowsAsync(request, cancellationToken);
}
