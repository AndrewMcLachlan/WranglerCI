using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace Asm.Wrangler.Api.Webhooks;

internal class InstallationRegistry(IDistributedCache cache) : IInstallationRegistry
{
    private static readonly TimeSpan DeliveryDedupeWindow = TimeSpan.FromMinutes(10);

    private static string InstallationKey(long id) => $"gh:install:{id}";
    private static string InstallationReposKey(long id) => $"gh:install:{id}:repos";
    private static string RepoLookupKey(string owner, string repo) => $"gh:repo:{owner}/{repo}:install";
    private static string DeliveryKey(string deliveryId) => $"gh:delivery:{deliveryId}";

    public async Task SaveInstallationAsync(long installationId, InstallationInfo info, IEnumerable<string> repos, CancellationToken cancellationToken)
    {
        await cache.SetStringAsync(InstallationKey(installationId), JsonSerializer.Serialize(info), cancellationToken);

        var repoList = repos.Distinct().ToList();
        await cache.SetStringAsync(InstallationReposKey(installationId), JsonSerializer.Serialize(repoList), cancellationToken);

        foreach (var repo in repoList)
        {
            await cache.SetStringAsync(RepoLookupKey(SplitOwner(repo), SplitRepo(repo)), installationId.ToString(), cancellationToken);
        }
    }

    public async Task RemoveInstallationAsync(long installationId, CancellationToken cancellationToken)
    {
        var repos = await GetRepositoriesAsync(installationId, cancellationToken);

        foreach (var repo in repos)
        {
            await cache.RemoveAsync(RepoLookupKey(SplitOwner(repo), SplitRepo(repo)), cancellationToken);
        }

        await cache.RemoveAsync(InstallationReposKey(installationId), cancellationToken);
        await cache.RemoveAsync(InstallationKey(installationId), cancellationToken);
    }

    public async Task SetSuspendedAsync(long installationId, bool suspended, CancellationToken cancellationToken)
    {
        var existing = await cache.GetStringAsync(InstallationKey(installationId), cancellationToken);
        if (String.IsNullOrEmpty(existing)) return;

        var info = JsonSerializer.Deserialize<InstallationInfo>(existing);
        if (info is null) return;

        var updated = info with { SuspendedAt = suspended ? DateTimeOffset.UtcNow : null };
        await cache.SetStringAsync(InstallationKey(installationId), JsonSerializer.Serialize(updated), cancellationToken);
    }

    public async Task AddRepositoriesAsync(long installationId, IEnumerable<string> repos, CancellationToken cancellationToken)
    {
        var current = await GetRepositoriesAsync(installationId, cancellationToken);
        var merged = current.Concat(repos).Distinct().ToList();
        await cache.SetStringAsync(InstallationReposKey(installationId), JsonSerializer.Serialize(merged), cancellationToken);

        foreach (var repo in repos.Distinct())
        {
            await cache.SetStringAsync(RepoLookupKey(SplitOwner(repo), SplitRepo(repo)), installationId.ToString(), cancellationToken);
        }
    }

    public async Task RemoveRepositoriesAsync(long installationId, IEnumerable<string> repos, CancellationToken cancellationToken)
    {
        var toRemove = repos.Distinct().ToHashSet(StringComparer.Ordinal);
        var current = await GetRepositoriesAsync(installationId, cancellationToken);
        var remaining = current.Where(r => !toRemove.Contains(r)).ToList();
        await cache.SetStringAsync(InstallationReposKey(installationId), JsonSerializer.Serialize(remaining), cancellationToken);

        foreach (var repo in toRemove)
        {
            await cache.RemoveAsync(RepoLookupKey(SplitOwner(repo), SplitRepo(repo)), cancellationToken);
        }
    }

    public async Task<long?> GetInstallationIdForRepoAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var value = await cache.GetStringAsync(RepoLookupKey(owner, repo), cancellationToken);
        return Int64.TryParse(value, out var id) ? id : null;
    }

    public async Task<bool> TryClaimDeliveryAsync(string deliveryId, CancellationToken cancellationToken)
    {
        var key = DeliveryKey(deliveryId);

        var existing = await cache.GetStringAsync(key, cancellationToken);
        if (!String.IsNullOrEmpty(existing)) return false;

        await cache.SetStringAsync(key, "1", new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = DeliveryDedupeWindow,
        }, cancellationToken);

        return true;
    }

    private async Task<List<string>> GetRepositoriesAsync(long installationId, CancellationToken cancellationToken)
    {
        var json = await cache.GetStringAsync(InstallationReposKey(installationId), cancellationToken);
        if (String.IsNullOrEmpty(json)) return [];

        return JsonSerializer.Deserialize<List<string>>(json) ?? [];
    }

    private static string SplitOwner(string ownerSlashRepo)
    {
        var idx = ownerSlashRepo.IndexOf('/');
        return idx < 0 ? ownerSlashRepo : ownerSlashRepo[..idx];
    }

    private static string SplitRepo(string ownerSlashRepo)
    {
        var idx = ownerSlashRepo.IndexOf('/');
        return idx < 0 ? String.Empty : ownerSlashRepo[(idx + 1)..];
    }
}
