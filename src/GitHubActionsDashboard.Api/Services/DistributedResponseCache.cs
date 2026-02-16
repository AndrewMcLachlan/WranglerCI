using System.Text;
using Microsoft.Extensions.Caching.Distributed;
using Newtonsoft.Json;
using Octokit.Caching;
using Octokit.Internal;

namespace GitHubActionsDashboard.Api.Services;

/// <summary>
/// An Octokit response cache backed by <see cref="IDistributedCache"/>.
/// </summary>
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
