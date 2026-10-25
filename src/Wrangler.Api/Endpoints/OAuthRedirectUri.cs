namespace Asm.Wrangler.Api.Endpoints;

/// <summary>
/// Picks the OAuth redirect URI for the host the user signed in on, so a sign-in returns to the same
/// origin (and its session cookie). Only configured URIs are used: the Host header is untrusted.
/// </summary>
internal static class OAuthRedirectUri
{
    /// <summary>
    /// Returns the configured <c>RedirectUris</c> entry whose host and port match <paramref name="host"/>,
    /// otherwise <c>RedirectUri</c>.
    /// </summary>
    public static string Resolve(IConfiguration configuration, HostString host)
    {
        var candidates = configuration.GetSection("RedirectUris").Get<string[]>() ?? [];

        var match = candidates.FirstOrDefault(uri =>
            Uri.TryCreate(uri, UriKind.Absolute, out var parsed) &&
            String.Equals(parsed.Authority, host.Value, StringComparison.OrdinalIgnoreCase));

        return match ?? configuration.GetValue<string>("RedirectUri") ?? throw new InvalidOperationException("RedirectUri is missing");
    }
}
