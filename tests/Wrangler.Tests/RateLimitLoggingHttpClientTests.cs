using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Wrangler.Tests;

public class RateLimitLoggingHttpClientTests
{
    [Fact]
    public async Task Logs_the_rate_limit_left_after_a_GitHub_call()
    {
        var logger = new CapturingLogger();
        var client = new TestableClient(new HttpContextAccessor(), logger);

        await client.Respond(Response(remaining: "4321", limit: "5000"));

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Information, entry.Level);
        Assert.Contains("/repos/acme/site/actions/runs", entry.Message);
        Assert.Contains("4321/5000", entry.Message);
        Assert.Contains("core", entry.Message);
    }

    [Fact]
    public async Task Warns_when_less_than_a_tenth_of_the_limit_is_left()
    {
        var logger = new CapturingLogger();
        var client = new TestableClient(new HttpContextAccessor(), logger);

        await client.Respond(Response(remaining: "499", limit: "5000"));

        Assert.Equal(LogLevel.Warning, Assert.Single(logger.Entries).Level);
    }

    [Fact]
    public async Task Logs_a_response_without_rate_limit_headers()
    {
        var logger = new CapturingLogger();
        var client = new TestableClient(new HttpContextAccessor(), logger);

        await client.Respond(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            RequestMessage = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user"),
            Content = new StringContent("{}"),
        });

        Assert.Equal(LogLevel.Information, Assert.Single(logger.Entries).Level);
    }

    private static HttpResponseMessage Response(string remaining, string limit)
    {
        var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            RequestMessage = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/repos/acme/site/actions/runs?status=waiting"),
            Content = new StringContent("{}"),
        };
        response.Headers.Add("x-ratelimit-remaining", remaining);
        response.Headers.Add("x-ratelimit-limit", limit);
        response.Headers.Add("x-ratelimit-resource", "core");
        response.Headers.Add("x-ratelimit-used", "679");
        response.Headers.Add("x-ratelimit-reset", "1790000000");
        return response;
    }

    private sealed class TestableClient(IHttpContextAccessor accessor, ILogger<RateLimitLoggingHttpClient> logger)
        : RateLimitLoggingHttpClient(accessor, logger)
    {
        public Task Respond(HttpResponseMessage response) => BuildResponse(response, body => body);
    }

    private sealed class CapturingLogger : ILogger<RateLimitLoggingHttpClient>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception)));
    }
}
