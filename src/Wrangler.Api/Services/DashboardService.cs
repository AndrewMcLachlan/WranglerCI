using System.Net;
using System.Text.Json;
using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Requests;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Provides dashboard operations for retrieving workflows and their runs.
/// </summary>
public interface IDashboardService
{
    /// <summary>
    /// Retrieves workflows and their latest runs for the repositories specified in the request.
    /// </summary>
    /// <param name="request">The repositories and workflow IDs to query.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The repositories with their workflows and latest runs.</returns>
    Task<IEnumerable<RepositoryModel>> GetWorkflowsAsync(WorkflowsRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Retrieves all workflows for a specific repository.
    /// </summary>
    /// <param name="owner">The repository owner.</param>
    /// <param name="repo">The repository name.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The workflows in the repository.</returns>
    Task<IEnumerable<WorkflowModel>> GetWorkflowsAsync(string owner, string repo, CancellationToken cancellationToken);

    /// <summary>
    /// Retrieves the most recent runs for a specific workflow, optionally filtered to a single branch.
    /// </summary>
    /// <param name="owner">The repository owner.</param>
    /// <param name="repo">The repository name.</param>
    /// <param name="workflowId">The workflow ID.</param>
    /// <param name="perPage">The maximum number of runs to return.</param>
    /// <param name="branch">The branch name to filter by, or <c>null</c> for all branches.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The most recent workflow runs.</returns>
    Task<IEnumerable<WorkflowRunModel>> GetLastRunsAsync(string owner, string repo, long workflowId, int perPage, string? branch, CancellationToken cancellationToken);

    /// <summary>
    /// Retrieves the most recent runs for a specific workflow, filtered by branch patterns.
    /// </summary>
    /// <param name="owner">The repository owner.</param>
    /// <param name="repo">The repository name.</param>
    /// <param name="workflowId">The workflow ID.</param>
    /// <param name="perPage">The maximum number of runs to return.</param>
    /// <param name="branches">The branch name patterns to filter by.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The most recent workflow runs matching the branch filters.</returns>
    Task<IEnumerable<WorkflowRunModel>> GetLastRunsAsync(string owner, string repo, long workflowId, int perPage, IEnumerable<string> branches, CancellationToken cancellationToken);
}

internal class DashboardService(IGitHubClient gitHubClient, IDistributedCache cache, ICacheKeyService cacheKeyService, ILogger<SettingsService> logger) : GitHubService(cache, logger), IDashboardService
{
    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<RepositoryModel>> GetWorkflowsAsync(WorkflowsRequest request, CancellationToken cancellationToken)
    {
        List<Task<Repository>> repoTasks = [.. request.Repositories.Select(repo => gitHubClient.Repository.Get(repo.Owner, repo.Name))];
        var workflowIds = request.Repositories.SelectMany(r => r.Workflows);

        Dictionary<Repository, IEnumerable<WorkflowModel>> workflows = [];
        Dictionary<Repository, Task<IEnumerable<WorkflowModel>>> workflowTasks = [];

        List<Task<IEnumerable<WorkflowRunModel>>> runsTasks = [];
        List<WorkflowRunModel> workflowRuns = [];

        List<RepositoryModel> results = [];

        var repositories = await Task.WhenAll(repoTasks);

        foreach (var repo in repositories)
        {
            workflowTasks.Add(repo, GetWorkflowsAsync(repo.Owner.Name ?? repo.Owner.Login, repo.Name, cancellationToken));
        }

        await Task.WhenAll(workflowTasks.Values);

        foreach (var task in workflowTasks)
        {
            workflows.Add(task.Key, [.. task.Value.Result.Where(wf => workflowIds.Any(id => id == wf.Id)).OrderBy(w => w.Name)]);
        }

        foreach (var repo in repositories)
        {
            //foreach (var workflow in repo.Workflows[repo].Select(w => w.Id))
            foreach (var workflow in workflows[repo])
            {
                runsTasks.Add(GetLastRunsAsync(repo.Owner.Login, repo.Name, workflow.Id, 1, repo.DefaultBranch, cancellationToken));
            }
        }

        await Task.WhenAll(runsTasks);

        foreach (var runTask in runsTasks)
        {
            workflowRuns.AddRange(runTask.Result);
        }

        foreach (var workflowRepo in workflows)
        {
            results.Add(new RepositoryModel
            {
                Name = workflowRepo.Key.Name,
                Owner = workflowRepo.Key.Owner.Name ?? workflowRepo.Key.Owner.Login,
                NodeId = workflowRepo.Key.NodeId,
                HtmlUrl = workflowRepo.Key.HtmlUrl,
                Workflows = workflowRepo.Value.Select(workflow => workflow with { Runs = [.. workflowRuns.Where(run => run.WorkflowId == workflow.Id)] }).OrderBy(workflow => workflow.Name),
            });
        }

        return results;
    }

    public async Task<IEnumerable<WorkflowModel>> GetWorkflowsAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var cacheKey = cacheKeyService.GetCacheKey($"gh:workflows:{owner}/{repo}");

        var cachedWorkflows = await TryGetFromCache<WorkflowModel>(cacheKey, cancellationToken);
        if (cachedWorkflows != null)
        {
            return cachedWorkflows;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var response = await OctoCall(() => gitHubClient.Actions.Workflows.List(owner, repo), cancellationToken);

            var workflows = response.Workflows.ToDashboardWorkflowModel();

            await TryCache(cacheKey, workflows, cancellationToken);

            return workflows;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IEnumerable<WorkflowRunModel>> GetLastRunsAsync(string owner, string repo, long workflowId, int perPage, string? branch, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var req = new Octokit.WorkflowRunsRequest
            {
                Branch = branch,

            };

            var response = await OctoCall(() =>
                gitHubClient.Actions.Workflows.Runs.ListByWorkflow(owner, repo, workflowId, req,
                    new ApiOptions
                    {
                        PageCount = 1,
                        PageSize = perPage,
                        StartPage = 1,
                    }), cancellationToken);

            return response.WorkflowRuns.Select(wr => new WorkflowRunModel()
            {
                Id = wr.Id,
                WorkflowId = wr.WorkflowId,
                NodeId = wr.NodeId,
                Conclusion = wr.Conclusion,
                CreatedAt = wr.CreatedAt,
                Event = wr.Event,
                HeadBranch = wr.HeadBranch,
                HtmlUrl = wr.HtmlUrl,
                RunNumber = wr.RunNumber,
                Status = wr.Status,
                TriggeringActor = wr.TriggeringActor?.Name ?? wr.TriggeringActor?.Login,
                UpdatedAt = wr.UpdatedAt,
            });
        }
        finally { _gate.Release(); }
    }

    public async Task<IEnumerable<WorkflowRunModel>> GetLastRunsAsync(string owner, string repo, long workflowId, int perPage, IEnumerable<string> branches, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            string? branch = null;
            if (branches.Count() == 1 && !branches.First().Contains('*'))
            {
                branch = branches.First();
            }

            await Jitter(cancellationToken);
            var req = new Octokit.WorkflowRunsRequest
            {
                Branch = branch,
            };

            var response = await OctoCall(() =>
                gitHubClient.Actions.Workflows.Runs.ListByWorkflow(owner, repo, workflowId, req,
                    new ApiOptions
                    {
                        PageCount = 1,
                        PageSize = perPage,
                        StartPage = 1,
                    }), cancellationToken);

            return response.WorkflowRuns
                .Where(wr => BranchFilter.Match(wr.HeadBranch, branches))
                .Select(wr => new WorkflowRunModel()
                {
                    Id = wr.Id,
                    WorkflowId = wr.WorkflowId,
                    NodeId = wr.NodeId,
                    Conclusion = wr.Conclusion,
                    CreatedAt = wr.CreatedAt,
                    Event = wr.Event,
                    HeadBranch = wr.HeadBranch,
                    HtmlUrl = wr.HtmlUrl,
                    RunNumber = wr.RunNumber,
                    Status = wr.Status,
                    TriggeringActor = wr.TriggeringActor?.Name ?? wr.TriggeringActor?.Login,
                    UpdatedAt = wr.UpdatedAt,
                });
        }
        finally { _gate.Release(); }
    }
}
