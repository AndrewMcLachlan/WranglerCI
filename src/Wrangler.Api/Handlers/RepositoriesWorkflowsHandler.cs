using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Handles requests to retrieve all workflows and their latest runs for a specific repository.
/// </summary>
public static class RepositoriesWorkflowsHandler
{
    /// <summary>
    /// Retrieves all workflows for a repository with their most recent runs, optionally filtered by branch.
    /// </summary>
    public static async Task<Ok<IEnumerable<WorkflowModel>>> Handle([FromServices] IDashboardService gitHubService, [FromRoute] string owner, [FromRoute] string repo, [FromBody] BranchFilterRequest request, CancellationToken cancellationToken)
    {
        Dictionary<WorkflowModel, Task<IEnumerable<WorkflowRunModel>>> runsTasks = [];

        IEnumerable<WorkflowModel> workflows = await gitHubService.GetWorkflowsAsync(owner, repo, cancellationToken);

        foreach (var workflow in workflows)
        {
            runsTasks.Add(workflow, gitHubService.GetLastRunsAsync(owner, repo, workflow.Id, 1, request.BranchFilters, cancellationToken));
        }

        await Task.WhenAll(runsTasks.Values);

        foreach (var runsTask in runsTasks)
        {
            runsTask.Key.Runs.AddRange(runsTask.Value.Result);

        }

        return TypedResults.Ok(workflows.AsEnumerable());
    }
}
