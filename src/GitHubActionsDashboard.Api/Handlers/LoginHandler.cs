namespace GitHubActionsDashboard.Api.Handlers;

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
        http.Session.SetString("oauth_state", state);

        var url = new UriBuilder("https://github.com/login/oauth/authorize");
        var query = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = redirectUri,
            ["state"] = state,
            ["scope"] = "read:user repo"
        };
        url.Query = String.Join('&', query.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));

        return Results.Redirect(url.ToString());
    }
}
