using GitHubActionsDashboard.Api.Handlers;
using GitHubActionsDashboard.Api.Models;
using GitHubActionsDashboard.Api.Models.Settings;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace GitHubActionsDashboard.Api.Services;

/// <summary>
/// Provides settings-related operations such as listing available repositories and workflows.
/// </summary>
public interface ISettingsService
{
    /// <summary>
    /// Lists all accessible repositories grouped by account, including their available workflows.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The accounts with their repositories and workflows.</returns>
    Task<IEnumerable<AccountModel>> ListAllWorkflowsAsync(CancellationToken cancellationToken);
}

internal class SettingsService(IGitHubClient gitHubClient, IDistributedCache cache, ICacheKeyService cacheKeyService, ILogger<SettingsService> logger) : GitHubService(cache, logger), ISettingsService
{
    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<AccountModel>> ListAllWorkflowsAsync(CancellationToken cancellationToken)
    {
        List<AccountModel> results = [];

        var cacheKey = cacheKeyService.GetCacheKey($"gh:workflows:all");

        var cachedRepos = await TryGetFromCache<AccountModel>(cacheKey, cancellationToken);

        if (cachedRepos != null)
        {
            return cachedRepos;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            var repos = await OctoCall(() => gitHubClient.Repository.GetAllForCurrent(), cancellationToken);

            repos.GroupBy(r => r.Owner, new OwnerEqualityComparer())
            .ToList()
            .ForEach(g =>
            {
                results.Add(new AccountModel()
                {
                    Login = g.Key.Login,
                    Type = g.Key.Type,
                    AvatarUrl = g.Key.AvatarUrl,
                    HtmlUrl = g.Key.HtmlUrl,
                    Repositories = [.. g.Where(r => !r.Archived).Select(r => new SettingsRepositoryModel
                    {
                        Name = r.Name,
                        NodeId = r.NodeId,
                        FullName = r.FullName,
                        Owner = r.Owner.Login,
                        HtmlUrl = r.HtmlUrl,
                    })],
                });
            });

            Dictionary<string, Task<WorkflowsResponse>> workflowTasks = [];

            foreach (var account in results)
            {
                foreach (var repo in account.Repositories)
                {
                    workflowTasks.Add(repo.NodeId, OctoCall(() => gitHubClient.Actions.Workflows.List(repo.Owner, repo.Name), cancellationToken));
                }
            }

            await Task.WhenAll(workflowTasks.Values);

            foreach (var repoWorkflows in workflowTasks)
            {
                var response = await repoWorkflows.Value;

                if (response.TotalCount == 0) continue;
                var repo = results.SelectMany(r => r.Repositories).Single(r => r.NodeId == repoWorkflows.Key);
                repo.Workflows.AddRange(response.Workflows.OrderBy(wf => wf.Name).ToWorkflowBase());
            }

            await TryCache(cacheKey, results, cancellationToken);

            return results;
        }
        finally
        {
            _gate.Release();
        }
    }
}
