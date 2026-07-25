using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Asm.Wrangler.Api.Authentication;

/// <summary>The token fields returned by GitHub's OAuth token endpoint.</summary>
public record GitHubTokenResponse(string AccessToken, string? RefreshToken, int? ExpiresIn, int? RefreshTokenExpiresIn);

/// <summary>
/// Persists GitHub OAuth credentials in the session and silently refreshes the user access token
/// using the stored refresh token before it expires, so the user is not bounced to a full GitHub
/// re-authorisation (and its corporate SSO prompt) every time the ~8-hour token lapses.
/// </summary>
public interface IGitHubTokenService
{
    /// <summary>
    /// Writes the access token to the session, plus the refresh token and absolute expiry timestamps
    /// when the response carries them (i.e. an expiring token).
    /// </summary>
    void StoreTokens(ISession session, GitHubTokenResponse tokens);

    /// <summary>
    /// Refreshes the access token in <paramref name="session"/> when it is at or near expiry and a
    /// refresh token is present. A no-op when there is no token, no refresh token, or the token is
    /// still fresh. On an unrecoverable refresh failure the credentials are cleared from the session
    /// so the request falls through to a 401 and the client redirects to a fresh login.
    /// </summary>
    Task EnsureFreshTokenAsync(ISession session, CancellationToken cancellationToken);
}

/// <inheritdoc />
public sealed class GitHubTokenService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    TimeProvider timeProvider,
    ILogger<GitHubTokenService> logger) : IGitHubTokenService
{
    private const string TokenEndpoint = "https://github.com/login/oauth/access_token";

    // Refresh a little before the token actually expires so in-flight requests never race the boundary.
    private static readonly TimeSpan RefreshBuffer = TimeSpan.FromMinutes(5);

    // Coalesces concurrent refreshes for the same session onto a single GitHub call. Refresh tokens are
    // single-use, so an uncoordinated burst (e.g. the dashboard's parallel requests after an overnight
    // expiry) would otherwise rotate the token out from under each other and force a spurious re-login.
    // Entries are removed once the shared refresh completes. Process-local, so this covers a single
    // instance; a scaled-out deployment would additionally need sticky sessions or a distributed lock,
    // and a request straggling in after the shared refresh completes may still trigger one extra refresh.
    private static readonly ConcurrentDictionary<string, Lazy<Task<GitHubTokenResponse?>>> InFlightRefreshes = new();

    /// <inheritdoc />
    public void StoreTokens(ISession session, GitHubTokenResponse tokens)
    {
        session.SetString(SessionKeys.AccessToken, tokens.AccessToken);

        // Only expiring tokens come with a refresh token; a classic non-expiring token is stored as-is
        // and never refreshed (there is nothing to refresh and no expiry to track).
        if (String.IsNullOrEmpty(tokens.RefreshToken)) return;

        session.SetString(SessionKeys.RefreshToken, tokens.RefreshToken);

        var now = timeProvider.GetUtcNow();
        if (tokens.ExpiresIn is int expiresIn)
            session.SetString(SessionKeys.TokenExpiresAt, now.AddSeconds(expiresIn).ToString("O", CultureInfo.InvariantCulture));
        if (tokens.RefreshTokenExpiresIn is int refreshTokenExpiresIn)
            session.SetString(SessionKeys.RefreshTokenExpiresAt, now.AddSeconds(refreshTokenExpiresIn).ToString("O", CultureInfo.InvariantCulture));
    }

    /// <inheritdoc />
    public async Task EnsureFreshTokenAsync(ISession session, CancellationToken cancellationToken)
    {
        var accessToken = session.GetString(SessionKeys.AccessToken);
        var refreshToken = session.GetString(SessionKeys.RefreshToken);

        // Nothing to do when unauthenticated or holding a non-expiring token (no refresh token stored).
        if (String.IsNullOrEmpty(accessToken) || String.IsNullOrEmpty(refreshToken)) return;

        // No recorded expiry (e.g. a session created before this feature shipped): leave it. The token
        // lapses once and the next login records the new fields.
        var expiresAtRaw = session.GetString(SessionKeys.TokenExpiresAt);
        if (!DateTimeOffset.TryParse(expiresAtRaw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var expiresAt))
            return;

        if (timeProvider.GetUtcNow() < expiresAt - RefreshBuffer) return; // still comfortably fresh

        var refreshed = await CoalescedRefreshAsync(session.Id, refreshToken);

        if (refreshed is null)
        {
            // Refresh token expired (~6 months, fixed from issuance) or revoked: drop the credentials so
            // the request 401s and the client redirects to a fresh login (the one genuine SSO prompt).
            ClearCredentials(session);
            await session.CommitAsync(cancellationToken);
            return;
        }

        StoreTokens(session, refreshed);
        // Commit immediately so a request starting moments later loads the rotated token from the store
        // rather than re-attempting a refresh with the now-invalidated one.
        await session.CommitAsync(cancellationToken);
    }

    private async Task<GitHubTokenResponse?> CoalescedRefreshAsync(string sessionId, string refreshToken)
    {
        var lazy = InFlightRefreshes.GetOrAdd(sessionId,
            _ => new Lazy<Task<GitHubTokenResponse?>>(() => RefreshAsync(refreshToken)));
        try
        {
            return await lazy.Value;
        }
        finally
        {
            // Remove only our own entry (value-matched) so a later refresh for the same session isn't
            // accidentally dropped.
            InFlightRefreshes.TryRemove(new KeyValuePair<string, Lazy<Task<GitHubTokenResponse?>>>(sessionId, lazy));
        }
    }

    private async Task<GitHubTokenResponse?> RefreshAsync(string refreshToken)
    {
        var clientId = configuration.GetValue<string>("ClientId");
        var clientSecret = configuration.GetValue<string>("ClientSecret");
        if (String.IsNullOrEmpty(clientId) || String.IsNullOrEmpty(clientSecret))
        {
            logger.LogError("Cannot refresh GitHub token: ClientId/ClientSecret are not configured.");
            return null;
        }

        // Detached from any single request's lifetime: this refresh is shared by every coalesced caller,
        // so one caller aborting must not cancel it. Bounded by its own timeout instead.
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

        using var request = new HttpRequestMessage(HttpMethod.Post, TokenEndpoint)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = clientId,
                ["client_secret"] = clientSecret,
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = refreshToken,
            }),
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            var client = httpClientFactory.CreateClient();
            using var response = await client.SendAsync(request, cts.Token);
            var body = await response.Content.ReadAsStringAsync(cts.Token);

            // GitHub returns HTTP 200 with an {"error": ...} body for a bad or expired refresh token, so a
            // success status is not sufficient — the presence of an access token is the real signal.
            var parsed = JsonSerializer.Deserialize<TokenEndpointResponse>(body);
            if (!response.IsSuccessStatusCode || parsed is null || String.IsNullOrEmpty(parsed.AccessToken))
            {
                logger.LogWarning("GitHub token refresh failed (status {Status}, error {Error}).",
                    (int)response.StatusCode, parsed?.Error ?? "unknown");
                return null;
            }

            return new GitHubTokenResponse(parsed.AccessToken, parsed.RefreshToken, parsed.ExpiresIn, parsed.RefreshTokenExpiresIn);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "GitHub token refresh request errored.");
            return null;
        }
    }

    private static void ClearCredentials(ISession session)
    {
        session.Remove(SessionKeys.AccessToken);
        session.Remove(SessionKeys.RefreshToken);
        session.Remove(SessionKeys.TokenExpiresAt);
        session.Remove(SessionKeys.RefreshTokenExpiresAt);
        session.Remove(SessionKeys.User);
        session.Remove(SessionKeys.AvatarUrl);
    }

    private sealed record TokenEndpointResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; init; }
        [JsonPropertyName("refresh_token")] public string? RefreshToken { get; init; }
        [JsonPropertyName("expires_in")] public int? ExpiresIn { get; init; }
        [JsonPropertyName("refresh_token_expires_in")] public int? RefreshTokenExpiresIn { get; init; }
        [JsonPropertyName("error")] public string? Error { get; init; }
    }
}
