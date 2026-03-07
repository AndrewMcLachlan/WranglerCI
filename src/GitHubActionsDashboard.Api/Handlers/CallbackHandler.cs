using System.Net.Http.Headers;
using System.Text.Json;
using System.Web;

namespace GitHubActionsDashboard.Api.Handlers;

/// <summary>
/// Handles the GitHub OAuth callback, exchanging the authorisation code for an access token.
/// </summary>
public static class CallbackHandler
{
    /// <summary>
    /// Exchanges the OAuth authorisation code for an access token, retrieves the user profile,
    /// and stores credentials in the session.
    /// </summary>
    /// <param name="http">The current HTTP context.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <returns>A redirect to the application root on success, or a bad request result on failure.</returns>
    /// <exception cref="InvalidOperationException">Thrown when required configuration values are missing.</exception>
    public static async Task<IResult> Handle(HttpContext http, IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        string clientId = configuration.GetValue<string>("ClientId") ?? throw new InvalidOperationException("ClientId is missing");
        string clientSecret = configuration.GetValue<string>("ClientSecret") ?? throw new InvalidOperationException("ClientSecret is missing");
        string redirectUri = configuration.GetValue<string>("RedirectUri") ?? throw new InvalidOperationException("RedirectUri is missing");

        var request = http.Request;

        // GitHub App installation callback — no OAuth exchange needed, just redirect home.
        if (!String.IsNullOrEmpty(request.Query["installation_id"]))
            return Results.Redirect("/");

        var code = request.Query["code"];
        var state = request.Query["state"];

        if (String.IsNullOrEmpty(code) || String.IsNullOrEmpty(state))
            return Results.BadRequest("Missing code or state.");

        var expectedState = http.Session.GetString("oauth_state");
        if (state != expectedState)
        {
            // Session may have been lost during the redirect chain. Retry once.
            if (request.Query["retry"] != "1")
                return Results.Redirect("/login/github?retry=1");
            return Results.BadRequest("Invalid state");
        }

        // Exchange code for access token
        var client = httpClientFactory.CreateClient();
        var tokenRes = await client.PostAsync("https://github.com/login/oauth/access_token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = clientId,
                ["client_secret"] = clientSecret,
                ["code"] = code!,
                ["redirect_uri"] = redirectUri
            }));

        var tokenBody = await tokenRes.Content.ReadAsStringAsync();
        var tokenData = ParseFormEncodedString(tokenBody);

        if (tokenData is null || !tokenData.TryGetValue("access_token", out var accessToken))
            return Results.BadRequest("Token exchange failed");

        // Get user info
        var userReq = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
        userReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        userReq.Headers.UserAgent.Add(new ProductInfoHeaderValue("GitHubActionsDashboard", "0.1"));

        var userRes = await client.SendAsync(userReq);
        var userJson = await userRes.Content.ReadAsStringAsync();

        if (!userRes.IsSuccessStatusCode)
            return Results.BadRequest("Failed to get user info");

        var user = JsonSerializer.Deserialize<JsonElement>(userJson);
        var login = user.GetProperty("login").GetString();

        // Store in session
        http.Session.SetString("github_access_token", accessToken);
        http.Session.SetString("github_user", login ?? "unknown");

        return Results.Redirect("/"); // or wherever your SPA is hosted
    }

    internal static Dictionary<string, string> ParseFormEncodedString(string formData)
    {
        var result = new Dictionary<string, string>();

        if (String.IsNullOrEmpty(formData))
            return result;

        var pairs = formData.Split('&');
        foreach (var pair in pairs)
        {
            var keyValue = pair.Split('=', 2);
            if (keyValue.Length == 2)
            {
                var key = HttpUtility.UrlDecode(keyValue[0]);
                var value = HttpUtility.UrlDecode(keyValue[1]);
                result[key] = value;
            }
        }

        return result;
    }
}
