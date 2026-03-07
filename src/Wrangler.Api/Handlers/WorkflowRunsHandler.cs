using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Octokit;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Handles requests to retrieve workflow runs for a specific workflow.
/// </summary>
public static class WorkflowRunsHandler
{
    /// <summary>
    /// Retrieves recent runs for the specified workflow, optionally filtered by branch.
    /// </summary>
    public static async Task<Ok<IEnumerable<WorkflowRunModel>>> Handle([FromServices] IDashboardService gitHubService, [FromRoute] string owner, [FromRoute] string repo, [FromRoute] long workflowId, Requests.WorkflowRunsRequest request, CancellationToken cancellationToken)
    {
        List<WorkflowRunModel> workflowRuns = [];

        string? branch = null;
        if (request.BranchFilters.Count() == 1 && !request.BranchFilters.First().Contains('*'))
        {
            branch = request.BranchFilters.First();
        }

        var response = await gitHubService.GetLastRunsAsync(owner, repo, workflowId, 10, branch, cancellationToken);

        var runs = response.Where(wr => BranchFilter.Match(wr.HeadBranch, request.BranchFilters));

        return TypedResults.Ok(runs);
    }
}
