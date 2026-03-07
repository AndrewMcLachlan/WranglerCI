using System.Security.Cryptography;
using System.Text;
using Asm.Wrangler.Api.Exceptions;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Generates user-scoped cache keys.
/// </summary>
public interface ICacheKeyService
{
    /// <summary>
    /// Returns a cache key scoped to the current authenticated user.
    /// </summary>
    /// <param name="key">The logical cache key.</param>
    /// <returns>A user-scoped cache key.</returns>
    string GetCacheKey(string key);
}

/// <summary>
/// Generates cache keys scoped by the current user's access token hash.
/// </summary>
public class CacheKeyService(IHttpContextAccessor httpContextAccessor) : ICacheKeyService
{
    /// <inheritdoc />
    public string GetCacheKey(string key)
    {
        var httpContext = httpContextAccessor.HttpContext;
        // TODO: base cache keys on user logins or IDs so they can span sessions
        var userToken = httpContext?.Session.GetString("github_access_token");
        if (String.IsNullOrEmpty(userToken))
        {
            throw new UnauthorizedException();
        }

        // Use token hash for cache key to isolate users
        var userHash = Convert.ToHexString(SHA512.HashData(Encoding.UTF8.GetBytes(userToken)));

        return $"{userHash}:{key}";
    }
}
