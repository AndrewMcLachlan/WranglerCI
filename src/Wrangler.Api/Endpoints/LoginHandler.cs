using Asm.Wrangler.Api.Authentication;

namespace Asm.Wrangler.Api.Endpoints;

/// <summary>
/// Handles the GitHub OAuth login flow by redirecting the user to GitHub's authorisation page.
/// </summary>
public static class LoginHandler
{
    /// <summary>
    /// Initiates the OAuth flow by redirecting to GitHub's authorisation endpoint.
    /// </summary>
    public static IResult Handle(HttpContext http, IConfiguration configuration)
    {
        string clientId = configuration.GetValue<string>("ClientId") ?? throw new InvalidOperationException("ClientId is missing");
        string redirectUri = configuration.GetValue<string>("RedirectUri") ?? throw new InvalidOperationException("RedirectUri is missing");

        // Always generate a fresh state to avoid stale values from previous flows.
        var state = Guid.NewGuid().ToString("N");
        http.Session.SetString(SessionKeys.OAuthState, state);

        // Remember where the user was so the callback can return them there. Only a safe local path is
        // stored; any stale value from a previous flow is cleared so a plain sign-in still lands home.
        var returnUrl = http.Request.Query["returnUrl"].ToString();
        if (ReturnUrl.IsLocalPath(returnUrl))
            http.Session.SetString(SessionKeys.PostLoginReturnUrl, returnUrl);
        else
            http.Session.Remove(SessionKeys.PostLoginReturnUrl);

        var url = new UriBuilder("https://github.com/login/oauth/authorize");
        var query = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = redirectUri,
            ["state"] = state,
            // security_events is required to read code scanning alerts on
            // private repos (issue #145); Dependabot and secret scanning alerts
            // are covered by repo. Existing sessions keep their old scope until
            // the user next logs in and re-consents.
            ["scope"] = "read:user repo security_events"
        };
        url.Query = String.Join('&', query.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));

        return Results.Redirect(url.ToString());
    }
}
