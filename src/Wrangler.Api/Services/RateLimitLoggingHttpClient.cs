using Asm.Wrangler.Api.Authentication;
using Octokit;
using Octokit.Internal;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Logs every call that reaches GitHub with the rate limit it left behind, and the Wrangler request
/// that caused it, so the calls spending the quota can be found.
/// </summary>
/// <remarks>
/// Must sit beneath Octokit's response cache, so that only calls that reach GitHub are logged.
/// </remarks>
public class RateLimitLoggingHttpClient(IHttpContextAccessor httpContextAccessor, ILogger<RateLimitLoggingHttpClient> logger)
    : HttpClientAdapter(HttpMessageHandlerFactory.CreateDefault)
{
    /// <inheritdoc />
    protected override async Task<IResponse> BuildResponse(HttpResponseMessage responseMessage, Func<object, object> preprocessResponseBody)
    {
        var request = responseMessage.RequestMessage;
        var http = httpContextAccessor.HttpContext;
        var remaining = Header(responseMessage, "x-ratelimit-remaining");
        var limit = Header(responseMessage, "x-ratelimit-limit");

        var level = Int32.TryParse(remaining, out var left) && Int32.TryParse(limit, out var total) && left < total / 10
            ? LogLevel.Warning
            : LogLevel.Information;

        logger.Log(level,
            "GitHub {GitHubMethod} {GitHubPath} {GitHubStatus} rate {RateLimitRemaining}/{RateLimitLimit} ({RateLimitResource}, used {RateLimitUsed}, resets {RateLimitReset}) for {User} via {WranglerMethod} {WranglerPath}",
            request?.Method.Method,
            request?.RequestUri?.PathAndQuery,
            (int)responseMessage.StatusCode,
            remaining,
            limit,
            Header(responseMessage, "x-ratelimit-resource"),
            Header(responseMessage, "x-ratelimit-used"),
            Int64.TryParse(Header(responseMessage, "x-ratelimit-reset"), out var reset) ? DateTimeOffset.FromUnixTimeSeconds(reset) : null,
            http?.Session.GetString(SessionKeys.User),
            http?.Request.Method,
            http?.Request.Path.Value);

        return await base.BuildResponse(responseMessage, preprocessResponseBody);
    }

    private static string? Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? values.FirstOrDefault() : null;
}
