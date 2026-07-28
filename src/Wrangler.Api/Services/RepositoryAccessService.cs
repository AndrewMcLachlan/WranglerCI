using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Answers whether the current user's GitHub token can access a repository. Used to gate the SSE event
/// stream so a user is never sent webhook events for repositories they cannot see. Results are cached
/// per user (the cache key includes the user's token) for a short window.
/// </summary>
public interface IRepositoryAccessService
{
    /// <summary>True if the current user's token can read <paramref name="owner"/>/<paramref name="repo"/>.</summary>
    Task<bool> CanAccessAsync(string owner, string repo, CancellationToken cancellationToken);
}

internal sealed class RepositoryAccessService(
    IGitHubClient client,
    IDistributedCache cache,
    ICacheKeyService cacheKeyService,
    ILogger<RepositoryAccessService> logger) : IRepositoryAccessService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public async Task<bool> CanAccessAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        // Keyed per user (ICacheKeyService folds in the caller's token), so one user's access decision
        // is never reused for another.
        var cacheKey = cacheKeyService.GetCacheKey($"repoaccess:{owner}/{repo}");

        var cached = await TryReadCacheAsync(cacheKey, cancellationToken);
        if (cached is not null) return cached.Value;

        bool canAccess;
        try
        {
            // GitHub returns 404 (not 403) for a private repo the user can't see, so it doesn't leak the
            // repo's existence; Octokit surfaces that as NotFoundException.
            await client.Repository.Get(owner, repo);
            canAccess = true;
        }
        catch (Octokit.NotFoundException)
        {
            canAccess = false;
        }
        catch (Octokit.ForbiddenException)
        {
            canAccess = false;
        }
        catch (Exception ex)
        {
            // Transient failure (rate limit, network). Fail closed for this event, but don't cache the
            // denial so a blip doesn't suppress the user's events for the whole TTL.
            logger.LogWarning(ex, "Repository access check failed for {Owner}/{Repo}; denying this event.", owner, repo);
            return false;
        }

        await TryWriteCacheAsync(cacheKey, canAccess, cancellationToken);
        return canAccess;
    }

    private async Task<bool?> TryReadCacheAsync(string cacheKey, CancellationToken cancellationToken)
    {
        try
        {
            var cached = await cache.GetStringAsync(cacheKey, cancellationToken);
            return cached is null ? null : cached == "1";
        }
        catch (Exception ex) when (ex is StackExchange.Redis.RedisException or InvalidOperationException)
        {
            // Cache unavailable — fall back to a live check.
            return null;
        }
    }

    private async Task TryWriteCacheAsync(string cacheKey, bool canAccess, CancellationToken cancellationToken)
    {
        try
        {
            await cache.SetStringAsync(cacheKey, canAccess ? "1" : "0",
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheTtl }, cancellationToken);
        }
        catch (Exception ex) when (ex is StackExchange.Redis.RedisException or InvalidOperationException)
        {
            // Caching is best-effort.
        }
    }
}
