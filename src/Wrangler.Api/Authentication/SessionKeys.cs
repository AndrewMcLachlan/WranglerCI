namespace Asm.Wrangler.Api.Authentication;

/// <summary>
/// Session key names for the GitHub login credentials. Centralised so the login
/// callback, the silent token-refresh service, and logout stay in sync.
/// </summary>
public static class SessionKeys
{
    /// <summary>The GitHub user access token used for API calls.</summary>
    public const string AccessToken = "github_access_token";

    /// <summary>The refresh token used to silently mint a new access token. Present only for expiring tokens.</summary>
    public const string RefreshToken = "github_refresh_token";

    /// <summary>Absolute UTC expiry of the access token, round-trip ("O") formatted.</summary>
    public const string TokenExpiresAt = "github_token_expires_at";

    /// <summary>Absolute UTC expiry of the refresh token, round-trip ("O") formatted.</summary>
    public const string RefreshTokenExpiresAt = "github_refresh_token_expires_at";

    /// <summary>The authenticated user's GitHub login.</summary>
    public const string User = "github_user";

    /// <summary>The authenticated user's avatar URL.</summary>
    public const string AvatarUrl = "github_avatar_url";

    /// <summary>The anti-forgery state value for an in-progress OAuth flow.</summary>
    public const string OAuthState = "oauth_state";

    /// <summary>Local path to return the user to after a successful login (set when login was triggered mid-session).</summary>
    public const string PostLoginReturnUrl = "post_login_return_url";
}
