using Asm.Wrangler.Api.Models.Users;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Searches GitHub users for the pull-request author typeahead.
/// </summary>
public interface IUserSearchService
{
    /// <summary>
    /// Searches GitHub users matching the given query. Returns an empty list for
    /// queries shorter than two characters or when the search cannot be served.
    /// </summary>
    /// <param name="query">The partial login/name to search for.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task<IEnumerable<UserSearchResult>> SearchUsersAsync(string query, CancellationToken cancellationToken);
}

internal class UserSearchService(IGitHubClient gitHubClient, IDistributedCache cache, ICacheKeyService cacheKeyService, ILogger<UserSearchService> logger)
    : GitHubService(cache, logger), IUserSearchService
{
    private const int MaxResults = 10;
    private const int MinQueryLength = 2;

    public async Task<IEnumerable<UserSearchResult>> SearchUsersAsync(string query, CancellationToken cancellationToken)
    {
        query = query.Trim();
        if (query.Length < MinQueryLength)
        {
            return [];
        }

        var cacheKey = cacheKeyService.GetCacheKey($"gh:users:search:{query.ToLowerInvariant()}");

        var cached = await TryGetFromCache<UserSearchResult>(cacheKey, cancellationToken);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            await Jitter(cancellationToken);
            var response = await OctoCall(() => gitHubClient.Search.SearchUsers(new SearchUsersRequest(query)
            {
                PerPage = MaxResults,
                Page = 1,
            }), cancellationToken);

            var results = response.Items
                .Take(MaxResults)
                .Select(u => new UserSearchResult
                {
                    Login = u.Login,
                    Name = u.Name,
                    AvatarUrl = u.AvatarUrl,
                })
                .ToList();

            await TryCache(cacheKey, results, cancellationToken);

            return results;
        }
        catch (RateLimitExceededException)
        {
            // The author typeahead should degrade quietly rather than surface an
            // error; the Search API's low limit makes this a realistic outcome.
            logger.LogWarning("GitHub user search rate limit reached; returning no suggestions.");
            return [];
        }
    }
}
