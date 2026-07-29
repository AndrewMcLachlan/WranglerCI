using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Resolves the current user's full set of accessible repositories once at SSE connect time, so the
/// event stream can filter events in-memory instead of making a GitHub API call per event. Results are
/// cached per user (the cache key includes the user's token) for a short window.
/// </summary>
public interface ISubscriberAuthorization
{
    /// <summary>The current user's accessible repositories, as lower-cased "owner/repo" strings.</summary>
    Task<IReadOnlySet<string>> GetAccessibleAsync(CancellationToken cancellationToken);
}

internal sealed class SubscriberAuthorizationService(
    IGitHubClient client,
    IDistributedCache cache,
    ICacheKeyService cacheKeyService,
    ILogger<SubscriberAuthorizationService> logger) : ISubscriberAuthorization
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private static readonly IReadOnlySet<string> Empty = new HashSet<string>();

    public async Task<IReadOnlySet<string>> GetAccessibleAsync(CancellationToken cancellationToken)
    {
        string cacheKey;
        try
        {
            // Keyed per user (ICacheKeyService folds in the caller's token), so one user's accessible
            // set is never reused for another.
            cacheKey = cacheKeyService.GetCacheKey("subscriber-repos");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to compute cache key for subscriber repos; denying access.");
            return Empty;
        }

        var cached = await TryReadCacheAsync(cacheKey, cancellationToken);
        if (cached is not null) return cached;

        IReadOnlySet<string> accessible;
        try
        {
            accessible = await ResolveAccessibleAsync();
        }
        catch (Exception ex)
        {
            // Fail closed on any resolution failure (rate limit, network, auth). Don't cache the
            // failure so a blip doesn't suppress the user's events for the whole TTL.
            logger.LogWarning(ex, "Failed to resolve accessible repositories; denying access for this connection.");
            return Empty;
        }

        await TryWriteCacheAsync(cacheKey, accessible, cancellationToken);
        return accessible;
    }

    private async Task<IReadOnlySet<string>> ResolveAccessibleAsync()
    {
        var repositories = new List<Repository>();

        var orgs = await client.Organization.GetAllForCurrent();

        foreach (var org in orgs)
        {
            repositories.AddRange(await client.Repository.GetAllForOrg(org.Name));
        }

        repositories.AddRange(await client.Repository.GetAllForCurrent());

        return repositories
            .Select(r => $"{r.Owner.Login}/{r.Name}".ToLowerInvariant())
            .ToHashSet();
    }

    private async Task<IReadOnlySet<string>?> TryReadCacheAsync(string cacheKey, CancellationToken cancellationToken)
    {
        try
        {
            var cached = await cache.GetStringAsync(cacheKey, cancellationToken);
            if (String.IsNullOrEmpty(cached)) return null;

            var deserialized = JsonSerializer.Deserialize<HashSet<string>>(cached);
            return deserialized is null ? null : (IReadOnlySet<string>)deserialized;
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Corrupted subscriber-repos cache entry; falling back to a live resolve.");
            return null;
        }
        catch (Exception ex) when (ex is StackExchange.Redis.RedisException or InvalidOperationException)
        {
            // Cache unavailable — fall back to a live resolve.
            return null;
        }
    }

    private async Task TryWriteCacheAsync(string cacheKey, IReadOnlySet<string> accessible, CancellationToken cancellationToken)
    {
        try
        {
            var json = JsonSerializer.Serialize(accessible);
            await cache.SetStringAsync(cacheKey, json,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheTtl }, cancellationToken);
        }
        catch (Exception ex) when (ex is StackExchange.Redis.RedisException or InvalidOperationException)
        {
            // Caching is best-effort.
        }
    }
}
