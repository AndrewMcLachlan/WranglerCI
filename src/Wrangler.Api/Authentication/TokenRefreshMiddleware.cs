namespace Asm.Wrangler.Api.Authentication;

/// <summary>
/// Before an authenticated API request runs, silently refreshes the GitHub access token if it is at
/// or near expiry, so the token never dies mid-session and forces a full re-authorisation (with its
/// corporate SSO prompt). Wire this only onto the API path — static files and the OAuth endpoints
/// don't need it.
/// </summary>
public sealed class TokenRefreshMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IGitHubTokenService tokenService)
    {
        await context.Session.LoadAsync(context.RequestAborted);

        // Only act for authenticated sessions; an unauthenticated request falls through to the usual 401.
        if (!String.IsNullOrEmpty(context.Session.GetString(SessionKeys.AccessToken)))
        {
            await tokenService.EnsureFreshTokenAsync(context.Session, context.RequestAborted);
        }

        await next(context);
    }
}
