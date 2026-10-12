using System.Text;
using Microsoft.Extensions.Caching.Distributed;
using Newtonsoft.Json;
using Octokit.Caching;
using Octokit.Internal;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// An Octokit response cache backed by <see cref="IDistributedCache"/>.
/// </summary>
/// <remarks>
/// Entries here are never served on their own. Octokit's <c>CachingHttpClient</c> only reads one to
/// put its ETag in an <c>If-None-Match</c> header, and reuses the body solely when GitHub answers
/// 304 — so GitHub, not this cache, decides whether the data is still current. An entry therefore
/// cannot go stale, and dropping one cannot make a response fresher: it only turns a conditional
/// request, which GitHub does not charge to the primary rate limit, into an unconditional one that
/// it does. That is why no per-repo version stamp is folded into the key, unlike the service-level
/// caches in <see cref="GitHubService"/>, which do hand back bodies without asking GitHub and so
/// have to be invalidated by webhooks.
/// </remarks>
public class DistributedResponseCache(IDistributedCache cache, ICacheKeyService cacheKeyService, ILogger<DistributedResponseCache> logger) : IResponseCache
{
    /// <inheritdoc />
    public async Task<CachedResponse.V1?> GetAsync(IRequest request)
    {
        var cacheKey = GetCacheKey(request);

        try
        {
            var cachedJson = await cache.GetStringAsync(cacheKey);

            if (String.IsNullOrEmpty(cachedJson))
            {
                logger.LogDebug("Cache miss for request {Request}", cacheKey);
                return null;
            }

            logger.LogDebug("Cache hit for request {Request}", cacheKey);

            var cachedResponse = JsonConvert.DeserializeObject<CachedResponse.V1>(cachedJson);

            return cachedResponse;
        }
        catch (JsonException jex)
        {
            // Corrupted cache data, remove it
            logger.LogWarning(jex, "Cache data for request {Request} is corrupted", cacheKey);
            await cache.RemoveAsync(cacheKey);
            return null;
        }
        catch (Exception e) when (e is InvalidOperationException || e is TimeoutException)
        {
            logger.LogWarning(e, "Failed to access cache for request {Request}", request.Endpoint);
            return null;
        }
    }

    /// <inheritdoc />
    public async Task SetAsync(IRequest request, Octokit.Caching.CachedResponse.V1 cachedResponse)
    {
        try
        {
            var cacheKey = GetCacheKey(request);

            var json = JsonConvert.SerializeObject(cachedResponse);
            await cache.SetStringAsync(cacheKey, json, new DistributedCacheEntryOptions
            {
                SlidingExpiration = TimeSpan.FromMinutes(30)
            });

            logger.LogDebug("Cached response for request {Request} with key {CacheKey}", request.Endpoint, cacheKey);
        }
        catch (Exception e) when (e is InvalidOperationException || e is TimeoutException)
        {
            logger.LogWarning(e, "Failed to access cache for request {Request}", request.Endpoint);
        }
    }

    private string GetCacheKey(IRequest request)
    {
        // Create a cache key from the request URL and parameters
        var keyBuilder = new StringBuilder();
        keyBuilder.Append(request.Method.Method);
        keyBuilder.Append(':');
        keyBuilder.Append(request.Endpoint.ToString());

        if (request.Parameters?.Count > 0)
        {
            keyBuilder.Append('?');
            foreach (var param in request.Parameters.OrderBy(p => p.Key))
            {
                keyBuilder.Append(param.Key);
                keyBuilder.Append('=');
                keyBuilder.Append(param.Value);
                keyBuilder.Append('&');
            }
        }

        return cacheKeyService.GetCacheKey($"gh:{keyBuilder.ToString().TrimEnd('&')}");
    }
}
