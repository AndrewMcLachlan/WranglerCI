using System.Diagnostics;
using System.Net;
using Asm.Wrangler.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Octokit;
using Xunit;

namespace Wrangler.Tests;

/// <summary>
/// A GitHub call used to be able to wait for as long as GitHub asked: up to three minutes of
/// secondary-rate-limit backoff, or until a primary rate limit reset, which is up to an hour away.
/// The request stays open that whole time, and past the reverse proxy's 100 second origin timeout
/// the browser gets a 524 while the work carries on for nobody.
/// </summary>
public class GitHubRetryTests
{
    [Fact]
    public void A_wait_within_the_budget_is_taken()
    {
        Assert.Equal(TimeSpan.FromSeconds(5), RetryBudget.NextDelay(TimeSpan.FromSeconds(5), TimeSpan.Zero));
    }

    [Fact]
    public void A_wait_that_would_overspend_the_budget_is_refused()
    {
        var almostSpent = RetryBudget.MaxTotalWait - TimeSpan.FromSeconds(1);

        Assert.Null(RetryBudget.NextDelay(TimeSpan.FromSeconds(5), almostSpent));
    }

    [Fact]
    public void A_rate_limit_reset_minutes_away_is_never_waited_for()
    {
        Assert.Null(RetryBudget.NextDelay(TimeSpan.FromMinutes(30), TimeSpan.Zero));
    }

    [Fact]
    public void The_budget_leaves_room_inside_the_proxy_timeout()
    {
        // Two sequential stages of calls must both fit inside Cloudflare's 100 second origin timeout.
        Assert.True(RetryBudget.MaxTotalWait * 2 < TimeSpan.FromSeconds(100));
    }

    [Fact]
    public async Task A_primary_rate_limit_fails_at_once_instead_of_waiting_for_reset()
    {
        var calls = 0;
        var resetInHalfAnHour = DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds();
        var stopwatch = Stopwatch.StartNew();

        await Assert.ThrowsAsync<RateLimitExceededException>(() => Probe.Call<int>(() =>
        {
            calls++;
            throw new RateLimitExceededException(new FakeResponse(HttpStatusCode.Forbidden, new RateLimit(5000, 0, resetInHalfAnHour)));
        }, TestContext.Current.CancellationToken));

        Assert.Equal(1, calls);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(5), $"Took {stopwatch.Elapsed}");
    }

    [Fact]
    public async Task A_transient_server_error_is_still_retried()
    {
        var calls = 0;

        var result = await Probe.Call(() =>
        {
            calls++;
            if (calls == 1) throw new ApiException("bad gateway", HttpStatusCode.BadGateway);
            return Task.FromResult(42);
        }, TestContext.Current.CancellationToken);

        Assert.Equal(42, result);
        Assert.Equal(2, calls);
    }

    private sealed class FakeResponse(HttpStatusCode status, RateLimit rateLimit) : IResponse
    {
        public object Body => "{}";
        public IReadOnlyDictionary<string, string> Headers { get; } = new Dictionary<string, string>();
        public ApiInfo ApiInfo { get; } = new(new Dictionary<string, Uri>(), [], [], "", rateLimit);
        public HttpStatusCode StatusCode => status;
        public string ContentType => "application/json";
    }

    /// <summary>OctoCall is protected; this is the narrowest way to reach it.</summary>
    private sealed class Probe() : GitHubService(null!, NullLogger.Instance)
    {
        public static Task<T> Call<T>(Func<Task<T>> operation, CancellationToken cancellationToken) =>
            OctoCall(operation, cancellationToken);
    }
}
