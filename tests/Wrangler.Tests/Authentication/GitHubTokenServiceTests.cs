using System.Globalization;
using System.Net;
using System.Text;
using Asm.Wrangler.Api.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Wrangler.Tests.Authentication;

public class GitHubTokenServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 25, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void StoreTokens_writes_access_refresh_and_absolute_expiries()
    {
        var session = new FakeSession();
        var service = CreateService(NeverCalledHandler());

        service.StoreTokens(session, new GitHubTokenResponse("at", "rt", 28800, 15897600));

        Assert.Equal("at", session.GetString(SessionKeys.AccessToken));
        Assert.Equal("rt", session.GetString(SessionKeys.RefreshToken));
        Assert.Equal(Now.AddSeconds(28800), ParseStored(session, SessionKeys.TokenExpiresAt));
        Assert.Equal(Now.AddSeconds(15897600), ParseStored(session, SessionKeys.RefreshTokenExpiresAt));
    }

    [Fact]
    public void StoreTokens_without_refresh_token_stores_only_access()
    {
        var session = new FakeSession();
        var service = CreateService(NeverCalledHandler());

        service.StoreTokens(session, new GitHubTokenResponse("at", null, null, null));

        Assert.Equal("at", session.GetString(SessionKeys.AccessToken));
        Assert.Null(session.GetString(SessionKeys.RefreshToken));
        Assert.Null(session.GetString(SessionKeys.TokenExpiresAt));
    }

    [Fact]
    public async Task EnsureFresh_is_noop_when_token_still_fresh()
    {
        var session = SessionWith(accessToken: "old", refreshToken: "rt", expiresAt: Now.AddHours(1));
        var handler = NeverCalledHandler();
        var service = CreateService(handler);

        await service.EnsureFreshTokenAsync(session, CancellationToken.None);

        Assert.Equal(0, handler.Calls);
        Assert.Equal("old", session.GetString(SessionKeys.AccessToken));
    }

    [Fact]
    public async Task EnsureFresh_is_noop_when_no_refresh_token()
    {
        var session = new FakeSession();
        session.SetString(SessionKeys.AccessToken, "at"); // non-expiring token: no refresh token, no expiry
        var handler = NeverCalledHandler();
        var service = CreateService(handler);

        await service.EnsureFreshTokenAsync(session, CancellationToken.None);

        Assert.Equal(0, handler.Calls);
        Assert.Equal("at", session.GetString(SessionKeys.AccessToken));
    }

    [Theory]
    [InlineData(-1)]  // already expired
    [InlineData(2)]   // within the 5-minute buffer
    public async Task EnsureFresh_refreshes_and_rotates_when_at_or_near_expiry(int minutesFromNow)
    {
        var session = SessionWith(accessToken: "old", refreshToken: "oldrt", expiresAt: Now.AddMinutes(minutesFromNow));
        var handler = JsonHandler(HttpStatusCode.OK,
            """{"access_token":"new","refresh_token":"newrt","expires_in":28800,"refresh_token_expires_in":15897600}""");
        var service = CreateService(handler);

        await service.EnsureFreshTokenAsync(session, CancellationToken.None);

        Assert.Equal(1, handler.Calls);
        Assert.Equal("new", session.GetString(SessionKeys.AccessToken));
        Assert.Equal("newrt", session.GetString(SessionKeys.RefreshToken));
        Assert.Equal(Now.AddSeconds(28800), ParseStored(session, SessionKeys.TokenExpiresAt));
    }

    [Fact]
    public async Task EnsureFresh_clears_credentials_when_github_returns_error_body()
    {
        // GitHub returns HTTP 200 with an error body for a bad/expired refresh token.
        var session = SessionWith(accessToken: "old", refreshToken: "deadrt", expiresAt: Now.AddMinutes(-1));
        session.SetString(SessionKeys.User, "octocat");
        var service = CreateService(JsonHandler(HttpStatusCode.OK, """{"error":"bad_refresh_token"}"""));

        await service.EnsureFreshTokenAsync(session, CancellationToken.None);

        Assert.Null(session.GetString(SessionKeys.AccessToken));
        Assert.Null(session.GetString(SessionKeys.RefreshToken));
        Assert.Null(session.GetString(SessionKeys.User));
    }

    [Fact]
    public async Task EnsureFresh_clears_credentials_on_http_failure()
    {
        var session = SessionWith(accessToken: "old", refreshToken: "rt", expiresAt: Now.AddMinutes(-1));
        var service = CreateService(JsonHandler(HttpStatusCode.Unauthorized, """{"error":"unauthorized"}"""));

        await service.EnsureFreshTokenAsync(session, CancellationToken.None);

        Assert.Null(session.GetString(SessionKeys.AccessToken));
    }

    // --- helpers ---

    private static GitHubTokenService CreateService(StubHandler handler)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ClientId"] = "id", ["ClientSecret"] = "secret" })
            .Build();
        return new GitHubTokenService(
            new StubHttpClientFactory(handler),
            config,
            new FixedTimeProvider(Now),
            NullLogger<GitHubTokenService>.Instance);
    }

    private static FakeSession SessionWith(string accessToken, string refreshToken, DateTimeOffset expiresAt)
    {
        var session = new FakeSession();
        session.SetString(SessionKeys.AccessToken, accessToken);
        session.SetString(SessionKeys.RefreshToken, refreshToken);
        session.SetString(SessionKeys.TokenExpiresAt, expiresAt.ToString("O", CultureInfo.InvariantCulture));
        return session;
    }

    private static DateTimeOffset ParseStored(ISession session, string key) =>
        DateTimeOffset.Parse(session.GetString(key)!, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);

    private static StubHandler NeverCalledHandler() =>
        new(_ => throw new InvalidOperationException("HTTP call was not expected."));

    private static StubHandler JsonHandler(HttpStatusCode status, string json) =>
        new(_ => new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") });

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(responder(request));
        }
    }

    private sealed class StubHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class FakeSession : ISession
    {
        private readonly Dictionary<string, byte[]> _store = new();

        public bool IsAvailable => true;
        public string Id { get; } = Guid.NewGuid().ToString("N");
        public IEnumerable<string> Keys => _store.Keys;

        public void Clear() => _store.Clear();
        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LoadAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Remove(string key) => _store.Remove(key);
        public void Set(string key, byte[] value) => _store[key] = value;
        public bool TryGetValue(string key, out byte[] value) => _store.TryGetValue(key, out value!);
    }
}
