using Microsoft.Extensions.Caching.Distributed;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Provides ETag caching for HTTP conditional requests.
/// </summary>
public interface IETagCacheService
{
    /// <summary>
    /// Retrieves a cached ETag for the specified URL.
    /// </summary>
    /// <param name="url">The request URL.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The cached ETag value, or <c>null</c> if not cached.</returns>
    Task<string?> GetETagAsync(Uri url, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stores an ETag for the specified URL.
    /// </summary>
    /// <param name="url">The request URL.</param>
    /// <param name="etag">The ETag value to cache.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SetETagAsync(Uri url, string etag, CancellationToken cancellationToken = default);
}

/// <summary>
/// Caches ETags in distributed cache for HTTP conditional request support.
/// </summary>
public class ETagCacheService(IDistributedCache cache, ICacheKeyService cacheKeyService) : IETagCacheService
{
    /// <inheritdoc />
    public async Task<string?> GetETagAsync(Uri url, CancellationToken cancellationToken = default)
    {
        try
        {
            var cacheKey = cacheKeyService.GetCacheKey($"etag:{url}");
            return await cache.GetStringAsync(cacheKey, cancellationToken);
        }
        catch
        {
            return null;
        }
    }

    /// <inheritdoc />
    public async Task SetETagAsync(Uri url, string etag, CancellationToken cancellationToken = default)
    {
        try
        {
            var cacheKey = cacheKeyService.GetCacheKey($"etag:{url}");
            await cache.SetStringAsync(cacheKey, etag, new DistributedCacheEntryOptions
            {
                SlidingExpiration = TimeSpan.FromHours(1) // ETags are valid until content changes
            }, cancellationToken);
        }
        catch
        {
            // Ignore cache failures
        }
    }
}
