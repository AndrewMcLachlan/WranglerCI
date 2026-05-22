namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Ends the current session, clearing the GitHub access token from
/// server-side state and dropping the session cookie on the client.
/// </summary>
public static class LogoutHandler
{
    public static async Task<IResult> Handle(HttpContext http)
    {
        // Remove all server-side session keys (github_access_token, github_user,
        // oauth_state, etc.). Any per-user cache entries keyed off the token's
        // hash are now orphaned and will fall off their 30-min sliding TTL.
        http.Session.Clear();
        await http.Session.CommitAsync();

        // Tell the browser to discard the session cookie so the next request
        // starts fresh.
        http.Response.Cookies.Delete(".GitHub.Session", new CookieOptions
        {
            Path = "/",
            Secure = true,
            SameSite = SameSiteMode.Lax,
        });

        return Results.NoContent();
    }
}
