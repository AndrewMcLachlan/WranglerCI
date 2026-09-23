using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

internal abstract class GitHubService(IDistributedCache cache, ILogger logger)
{
    protected static async Task<T> OctoCall<T>(Func<Task<T>> operation, CancellationToken cancellationToken, int maxAttempts = 4)
    {
        const int baseMs = 250;
        const int capMs = 8000;

        // Every wait is drawn from one budget, and a wait that would overspend it is not taken: the
        // failure goes straight through instead. A primary rate limit, which resets in minutes, fails
        // at once rather than holding the request open past the proxy's timeout.
        var waited = TimeSpan.Zero;

        for (int attempt = 0; attempt < maxAttempts; attempt++)
        {
            try
            {
                return await operation();
            }
            catch (AbuseException ex) when (attempt < maxAttempts - 1)
            {
                // Secondary rate-limit; honor Retry-After if present.
                var proposed = ex.RetryAfterSeconds.HasValue
                    ? TimeSpan.FromSeconds(Math.Max(1, ex.RetryAfterSeconds.Value))
                    : FullJitter(attempt, baseMs, capMs);
                if (RetryBudget.NextDelay(proposed, waited) is not { } delay) throw;
                waited += delay;
                await Task.Delay(delay, cancellationToken);
            }
            catch (RateLimitExceededException ex) when (attempt < maxAttempts - 1)
            {
                var proposed = ex.Reset - DateTimeOffset.UtcNow + TimeSpan.FromSeconds(1);
                if (proposed < TimeSpan.Zero) proposed = FullJitter(attempt, baseMs, capMs);
                if (RetryBudget.NextDelay(proposed, waited) is not { } delay) throw;
                waited += delay;
                await Task.Delay(delay, cancellationToken);
            }
            catch (ApiException ex) when (attempt < maxAttempts - 1 && IsRetryable(ex))
            {
                if (RetryBudget.NextDelay(FullJitter(attempt, baseMs, capMs), waited) is not { } delay) throw;
                waited += delay;
                await Task.Delay(delay, cancellationToken);
            }
            catch (HttpRequestException) when (attempt < maxAttempts - 1)
            {
                if (RetryBudget.NextDelay(FullJitter(attempt, baseMs, capMs), waited) is not { } delay) throw;
                waited += delay;
                await Task.Delay(delay, cancellationToken);
            }
        }

        // Final try (bubble on failure)
        return await operation();

        static bool IsRetryable(ApiException ex)
        {
            var code = (int)ex.StatusCode;
            if (code is 500 or 502 or 503 or 504) return true;
            if (ex.StatusCode == HttpStatusCode.Forbidden) // only retry if server hinted a backoff
                return ex.Message.Contains("rate limit", StringComparison.OrdinalIgnoreCase) ||
                       ex.Message.Contains("abuse", StringComparison.OrdinalIgnoreCase);
            return false;
        }

        static TimeSpan FullJitter(int attempt, int baseMs, int capMs)
        {
            var max = Math.Min(capMs, (int)(baseMs * Math.Pow(2, attempt)));
            return TimeSpan.FromMilliseconds(Random.Shared.Next(0, Math.Max(1, max)));
        }
    }

    protected static Task Jitter(CancellationToken cancellationToken) =>
        Task.Delay(Random.Shared.Next(0, 200), cancellationToken);

    protected async Task<IEnumerable<T>?> TryGetFromCache<T>(string cacheKey, CancellationToken cancellationToken)
    {
        try
        {
            var cachedJson = await cache.GetStringAsync(cacheKey, cancellationToken);
            if (String.IsNullOrEmpty(cachedJson))
                return null;

            return JsonSerializer.Deserialize<IEnumerable<T>>(cachedJson);
        }
        catch (JsonException)
        {
            // Corrupted cache data, remove it
            await cache.RemoveAsync(cacheKey, cancellationToken);
            return null;
        }
        catch (InvalidOperationException)
        {
            // Redis connection issue, continue without cache
            return null;
        }
    }

    protected async Task TryCache<T>(string cacheKey, IEnumerable<T> workflows, CancellationToken cancellationToken)
    {
        try
        {
            var json = JsonSerializer.Serialize(workflows);
            await cache.SetStringAsync(cacheKey, json, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30)
            }, cancellationToken);
        }
        catch (JsonException jex)
        {
            logger.LogError(jex, "Failed to serialize data for caching key: {Key}", cacheKey);
        }
        catch (StackExchange.Redis.RedisException rex)
        {
            logger.LogError(rex, "Error caching to redis: {Key}", cacheKey);
        }
    }
}
