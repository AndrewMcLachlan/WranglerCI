using System.Net;
using System.Text.Json;
using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Queries;
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
    Task<IEnumerable<RepositoryModel>> GetWorkflowsAsync(Workflows request, CancellationToken cancellationToken);

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

    public async Task<IEnumerable<RepositoryModel>> GetWorkflowsAsync(Workflows request, CancellationToken cancellationToken)
    {
        List<Task<RepositorySummary>> repoTasks = [.. request.Repositories.Select(repo => GetRepositoryAsync(repo.Owner, repo.Name, cancellationToken))];
        var workflowIds = request.Repositories.SelectMany(r => r.Workflows);

        Dictionary<RepositorySummary, IEnumerable<WorkflowModel>> workflows = [];
        Dictionary<RepositorySummary, Task<IEnumerable<WorkflowModel>>> workflowTasks = [];

        List<Task<IEnumerable<WorkflowRunModel>>> runsTasks = [];
        List<WorkflowRunModel> workflowRuns = [];

        List<RepositoryModel> results = [];

        var repositories = await Task.WhenAll(repoTasks);

        // Look up display names for each distinct owner
        var ownerNameTasks = repositories.DistinctBy(r => r.Owner).ToDictionary(r => r.Owner, r => GetOwnerNameAsync(r.Owner, r.OwnerIsOrganisation, cancellationToken));
        await Task.WhenAll(ownerNameTasks.Values);

        foreach (var repo in repositories)
        {
            workflowTasks.Add(repo, GetWorkflowsAsync(repo.Owner, repo.Name, cancellationToken));
        }

        await Task.WhenAll(workflowTasks.Values);

        foreach (var task in workflowTasks)
        {
            workflows.Add(task.Key, [.. task.Value.Result.Where(wf => workflowIds.Any(id => id == wf.Id)).OrderBy(w => w.Name)]);
        }

        var hasBranchFilters = request.BranchFilters.Any();

        // Once per repository: a glob costs a walk of every branch.
        var branchTasks = hasBranchFilters
            ? repositories.Where(repo => workflows[repo].Any()).ToDictionary(repo => repo, repo => ResolveBranchesAsync(repo.Owner, repo.Name, request.BranchFilters, cancellationToken))
            : [];
        await Task.WhenAll(branchTasks.Values);

        foreach (var repo in repositories)
        {
            foreach (var workflow in workflows[repo])
            {
                if (hasBranchFilters)
                {
                    foreach (var branch in branchTasks[repo].Result)
                    {
                        runsTasks.Add(GetLastRunsAsync(repo.Owner, repo.Name, workflow.Id, 1, branch, cancellationToken));
                    }
                }
                else
                {
                    runsTasks.Add(GetLastRunsAsync(repo.Owner, repo.Name, workflow.Id, 1, repo.DefaultBranch, cancellationToken));
                }
            }
        }

        await Task.WhenAll(runsTasks);

        foreach (var runTask in runsTasks)
        {
            workflowRuns.AddRange(runTask.Result);
        }

        // Skip repos whose selected workflows resolved to nothing (e.g. all
        // workflows deselected in settings) so the dashboard doesn't render an
        // empty card for them (issue #172).
        foreach (var workflowRepo in workflows.Where(wr => wr.Value.Any()))
        {
            results.Add(new RepositoryModel
            {
                Name = workflowRepo.Key.Name,
                // Owner is the login, as the contract says: the stream's events
                // identify a repository by login, and a display name here means
                // a pushed run matches nothing for every account whose name and
                // login differ.
                Owner = workflowRepo.Key.Owner,
                OwnerName = (await ownerNameTasks[workflowRepo.Key.Owner]) ?? workflowRepo.Key.Owner,
                NodeId = workflowRepo.Key.NodeId,
                HtmlUrl = workflowRepo.Key.HtmlUrl,
                Workflows = workflowRepo.Value.Select(workflow => workflow with { Runs = [.. workflowRuns.Where(run => run.WorkflowId == workflow.Id)] }).OrderBy(workflow => workflow.Name),
            });
        }

        return results;
    }

    private async Task<RepositorySummary> GetRepositoryAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var cacheKey = cacheKeyService.GetCacheKey($"gh:repository:{owner}/{repo}");

        var cached = await TryGetFromCache<RepositorySummary>(cacheKey, cancellationToken);
        if (cached?.FirstOrDefault() is { } summary) return summary;

        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var repository = await OctoCall(() => gitHubClient.Repository.Get(owner, repo), cancellationToken);
            summary = new(repository.Owner.Login, repository.Name, repository.Owner.Type == AccountType.Organization, repository.DefaultBranch, repository.NodeId, repository.HtmlUrl);

            await TryCache(cacheKey, [summary], cancellationToken);
            return summary;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<string?> GetOwnerNameAsync(string owner, bool isOrganisation, CancellationToken cancellationToken)
    {
        var cacheKey = cacheKeyService.GetCacheKey($"gh:owner-name:{owner}");

        var cached = await TryGetFromCache<string?>(cacheKey, cancellationToken);
        if (cached is not null) return cached.FirstOrDefault();

        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var name = isOrganisation
                ? (await OctoCall(() => gitHubClient.Organization.Get(owner), cancellationToken)).Name
                : (await OctoCall(() => gitHubClient.User.Get(owner), cancellationToken)).Name;

            await TryCache(cacheKey, [name], cancellationToken);
            return name;
        }
        finally
        {
            _gate.Release();
        }
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
        // No filters: fall back to the repository's default branch so callers
        // get a sensible result instead of an empty list.
        if (!branches.Any())
        {
            var repository = await GetRepositoryAsync(owner, repo, cancellationToken);
            return await GetLastRunsAsync(owner, repo, workflowId, perPage, repository.DefaultBranch, cancellationToken);
        }

        List<WorkflowRunModel> results = [];
        foreach (var branch in await ResolveBranchesAsync(owner, repo, branches, cancellationToken))
        {
            var runs = await GetLastRunsAsync(owner, repo, workflowId, perPage, branch, cancellationToken);
            results.AddRange(runs);
        }

        return results;
    }

    private async Task<IReadOnlyList<string>> ResolveBranchesAsync(string owner, string repo, IEnumerable<string> branches, CancellationToken cancellationToken)
    {
        var exactBranches = branches.Where(b => !b.Contains('*')).ToList();
        var globPatterns = branches.Where(b => b.Contains('*')).ToList();

        if (globPatterns.Count > 0)
        {
            await _gate.WaitAsync(cancellationToken);
            try
            {
                var repoBranches = await OctoCall(() => gitHubClient.Repository.Branch.GetAll(owner, repo), cancellationToken);
                var matchedBranches = repoBranches
                    .Where(b => BranchFilter.Match(b.Name, globPatterns))
                    .Select(b => b.Name);
                exactBranches.AddRange(matchedBranches);
            }
            finally { _gate.Release(); }
        }

        return [.. exactBranches.Distinct()];
    }
}

/// <summary>
/// What the dashboard needs from a repository, small enough to cache.
/// </summary>
internal record RepositorySummary(string Owner, string Name, bool OwnerIsOrganisation, string DefaultBranch, string NodeId, string HtmlUrl);
