namespace Asm.Wrangler.Api.Models;

/// <summary>
/// Configuration for the GitHub App used to receive webhook deliveries.
/// Bound from the <c>GitHubApp</c> configuration section.
/// </summary>
public class GitHubAppOptions
{
    public const string SectionName = "GitHubApp";

    /// <summary>
    /// The GitHub App's numeric ID. Required for App-level auth (JWT signing).
    /// Not used until Phase 4 — installation backfill.
    /// </summary>
    public string? AppId { get; init; }

    /// <summary>
    /// The OAuth client ID associated with the GitHub App. Already present in
    /// <c>appsettings.json</c> under the top-level <c>ClientId</c> key; mirrored
    /// here for clarity when binding the full options object.
    /// </summary>
    public string? ClientId { get; init; }

    /// <summary>
    /// The shared secret configured on the GitHub App's webhook settings.
    /// Used to verify HMAC-SHA256 signatures on incoming webhook deliveries.
    /// </summary>
    public string? WebhookSecret { get; init; }

    /// <summary>
    /// PEM-encoded RSA private key for the GitHub App. Required to mint JWTs
    /// for App-level API calls (Phase 4).
    /// </summary>
    public string? PrivateKeyPem { get; init; }
}
