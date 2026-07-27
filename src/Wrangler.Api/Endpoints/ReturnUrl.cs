namespace Asm.Wrangler.Api.Endpoints;

/// <summary>
/// Validates and resolves the post-login return URL. The value originates from a query string, so it
/// is untrusted: only same-site relative paths are honoured, to prevent an open-redirect through the
/// login flow.
/// </summary>
internal static class ReturnUrl
{
    /// <summary>The destination used when no valid return URL is supplied.</summary>
    public const string Fallback = "/dashboard";

    /// <summary>Returns <paramref name="returnUrl"/> if it is a safe local path, otherwise <see cref="Fallback"/>.</summary>
    public static string ResolveOrFallback(string? returnUrl) =>
        IsLocalPath(returnUrl) ? returnUrl! : Fallback;

    /// <summary>
    /// True only for a same-site relative path (e.g. "/pull-requests", "/gates?author=x"). Rejects
    /// absolute URLs, protocol-relative ("//host") and backslash ("/\host") forms, and the auth/api
    /// surface (loop guard).
    /// </summary>
    public static bool IsLocalPath(string? url)
    {
        if (String.IsNullOrEmpty(url)) return false;

        // Must be rooted, and must not be protocol-relative or a backslash trick that browsers treat
        // as an absolute URL ("//evil.com", "/\evil.com").
        if (url[0] != '/') return false;
        if (url.Length > 1 && (url[1] == '/' || url[1] == '\\')) return false;

        // Don't bounce back into the auth or API surface — that risks a redirect loop.
        return !url.StartsWith("/login", StringComparison.OrdinalIgnoreCase)
            && !url.StartsWith("/callback", StringComparison.OrdinalIgnoreCase)
            && !url.StartsWith("/api", StringComparison.OrdinalIgnoreCase);
    }
}
