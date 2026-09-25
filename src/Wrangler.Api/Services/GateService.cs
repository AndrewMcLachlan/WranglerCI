using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Commands;
using Asm.Wrangler.Api.Queries;
using Asm.Wrangler.Api.Webhooks;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Discovers workflow runs paused at environment protection rules and
/// approves them on the user's behalf.
/// </summary>
public interface IGateService
{
    Task<IEnumerable<DeploymentGateModel>> GetGatesAsync(Gates request, CancellationToken cancellationToken);
    Task<IEnumerable<GateApprovalResult>> ApproveGatesAsync(ApproveGates request, CancellationToken cancellationToken);
}

internal class GateService(IGitHubClient gitHubClient, IDistributedCache cache, ICacheKeyService cacheKeyService, IRepoVersionService versions, ILogger<GateService> logger)
    : GitHubService(cache, logger), IGateService
{
    /// <summary>
    /// How long a repo's gates are trusted without a webhook saying otherwise. Bounds how late a gate
    /// shows up for a repo whose deployment_review deliveries never arrive.
    /// </summary>
    internal static readonly TimeSpan GateCacheLifetime = TimeSpan.FromMinutes(30);

    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<DeploymentGateModel>> GetGatesAsync(Gates request, CancellationToken cancellationToken)
    {
        var repoTasks = request.Repositories.Select(repo => GetRepoGatesAsync(repo.Owner, repo.Name, cancellationToken));
        var perRepo = await Task.WhenAll(repoTasks);

        return perRepo
            .SelectMany(items => items)
            .OrderByDescending(item => item.UpdatedAt);
    }

    private async Task<IEnumerable<DeploymentGateModel>> GetRepoGatesAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var version = await versions.GetVersionAsync(owner, repo, RepoDataKind.Gates, cancellationToken);
        var cacheKey = cacheKeyService.GetCacheKey($"gh:gates:{owner}/{repo}:v{version}");

        var cached = await TryGetFromCache<DeploymentGateModel>(cacheKey, cancellationToken);
        if (cached is not null) return cached;

        var gates = (await FetchRepoGatesAsync(owner, repo, cancellationToken)).ToList();
        await TryCache(cacheKey, gates, cancellationToken, GateCacheLifetime);
        return gates;
    }

    private async Task<IEnumerable<DeploymentGateModel>> FetchRepoGatesAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        WorkflowRunsResponse waitingRuns;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            waitingRuns = await OctoCall(() => gitHubClient.Actions.Workflows.Runs.List(owner, repo, new Octokit.WorkflowRunsRequest
            {
                Status = new StringEnum<CheckRunStatusFilter>(CheckRunStatusFilter.Waiting),
            }), cancellationToken);
        }
        finally
        {
            _gate.Release();
        }

        var runTasks = waitingRuns.WorkflowRuns.Select(run => GetRunGatesAsync(owner, repo, run, cancellationToken));
        var perRun = await Task.WhenAll(runTasks);
        return perRun.SelectMany(g => g);
    }

    private async Task<IEnumerable<DeploymentGateModel>> GetRunGatesAsync(string owner, string repo, WorkflowRun run, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            // Octokit 14 has no typed read for pending deployments, so hit the
            // REST endpoint directly. Octokit's serializer maps the snake_case
            // JSON onto our PascalCase PendingDeploymentResponse.
            var response = await OctoCall(() => gitHubClient.Connection.Get<PendingDeploymentResponse[]>(
                ApiUrls.ActionsWorkflowRunPendingDeployments(owner, repo, run.Id), null, null, cancellationToken), cancellationToken);

            var pending = response.Body ?? [];

            return pending.Select(p => new DeploymentGateModel
            {
                RepositoryOwner = owner,
                RepositoryName = repo,
                WorkflowRunId = run.Id,
                RunNumber = run.RunNumber,
                WorkflowName = run.Name,
                HeadBranch = run.HeadBranch,
                Event = run.Event,
                HtmlUrl = run.HtmlUrl,
                CreatedAt = run.CreatedAt,
                UpdatedAt = run.UpdatedAt,
                EnvironmentId = p.Environment.Id,
                EnvironmentName = p.Environment.Name,
                CurrentUserCanApprove = p.CurrentUserCanApprove,
            }).ToList();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IEnumerable<GateApprovalResult>> ApproveGatesAsync(ApproveGates request, CancellationToken cancellationToken)
    {
        var groups = GateReviewPlanner.GroupForReview(request.Gates);

        var groupTasks = groups.Select(group => ApproveRunAsync(group, cancellationToken));
        var perGroup = await Task.WhenAll(groupTasks);
        return perGroup.SelectMany(r => r);
    }

    private async Task<IEnumerable<GateApprovalResult>> ApproveRunAsync(GateReviewGroup group, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            var review = new PendingDeploymentReview([.. group.EnvironmentIds], PendingDeploymentReviewState.Approved, String.Empty);

            try
            {
                await OctoCall(() => gitHubClient.Actions.Workflows.Runs.ReviewPendingDeployments(
                    group.Owner, group.Repo, group.RunId, review), cancellationToken);
                await versions.BumpAsync(group.Owner, group.Repo, RepoDataKind.Gates, cancellationToken);

                return group.Gates.Select(g => new GateApprovalResult
                {
                    RepositoryOwner = group.Owner,
                    RepositoryName = group.Repo,
                    WorkflowRunId = group.RunId,
                    EnvironmentName = g.EnvironmentName,
                    Approved = true,
                }).ToList();
            }
            catch (Exception ex)
            {
                return group.Gates.Select(g => new GateApprovalResult
                {
                    RepositoryOwner = group.Owner,
                    RepositoryName = group.Repo,
                    WorkflowRunId = group.RunId,
                    EnvironmentName = g.EnvironmentName,
                    Approved = false,
                    Error = ex.Message,
                }).ToList();
            }
        }
        finally
        {
            _gate.Release();
        }
    }
}
