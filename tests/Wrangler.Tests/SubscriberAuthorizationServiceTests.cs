using System.Net;
using System.Text;
using Asm.Wrangler.Api.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Octokit;
using Octokit.Internal;
using Xunit;

namespace Wrangler.Tests;

public class SubscriberAuthorizationServiceTests
{
    [Fact]
    public async Task Resolves_accessible_set_from_orgs_and_user_repos()
    {
        var handler = new StubHandler();
        var cache = new FakeCache();
        var service = Service(handler, cache);

        var accessible = await service.GetAccessibleAsync(CancellationToken.None);

        Assert.Contains("org1/org-repo", accessible);
        Assert.Contains("owner/user-repo", accessible);
        Assert.Equal(2, accessible.Count);
    }

    [Fact]
    public async Task Second_call_is_served_from_cache_without_new_http_calls()
    {
        var handler = new StubHandler();
        var cache = new FakeCache();
        var service = Service(handler, cache);

        await service.GetAccessibleAsync(CancellationToken.None);
        var callsAfterFirst = handler.Calls;
        Assert.True(callsAfterFirst > 0);

        var second = await service.GetAccessibleAsync(CancellationToken.None);

        Assert.Equal(callsAfterFirst, handler.Calls);
        Assert.Contains("org1/org-repo", second);
        Assert.Contains("owner/user-repo", second);
    }

    [Fact]
    public async Task Returns_empty_set_on_failure()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("boom"));
        var cache = new FakeCache();
        var service = Service(handler, cache);

        var accessible = await service.GetAccessibleAsync(CancellationToken.None);

        Assert.Empty(accessible);
    }

    private static SubscriberAuthorizationService Service(HttpMessageHandler handler, IDistributedCache cache)
    {
        var connection = new Connection(new ProductHeaderValue("wrangler-tests"), new HttpClientAdapter(() => handler));
        return new SubscriberAuthorizationService(new GitHubClient(connection), cache, new FakeCacheKeys(), NullLogger<SubscriberAuthorizationService>.Instance);
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private sealed class FakeCacheKeys : ICacheKeyService
    {
        public string GetCacheKey(string key) => "u:" + key;
    }

    /// <summary>
    /// Stubs the GitHub API sequence used to resolve accessible repos: GET /user/orgs, GET
    /// /orgs/{org}/repos per org, and GET /user/repos.
    /// </summary>
    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage>? responder = null) : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;

            if (responder is not null) return Task.FromResult(responder(request));

            var path = request.RequestUri!.AbsolutePath;

            if (path == "/user/orgs")
            {
                return Task.FromResult(Json(HttpStatusCode.OK,
                    """[{"id":1,"login":"org1","name":"org1"}]"""));
            }

            if (path == "/orgs/org1/repos")
            {
                return Task.FromResult(Json(HttpStatusCode.OK,
                    """[{"id":10,"name":"org-repo","full_name":"org1/org-repo","owner":{"login":"org1","id":1}}]"""));
            }

            if (path == "/user/repos")
            {
                return Task.FromResult(Json(HttpStatusCode.OK,
                    """[{"id":20,"name":"user-repo","full_name":"owner/user-repo","owner":{"login":"owner","id":2}}]"""));
            }

            return Task.FromResult(Json(HttpStatusCode.NotFound, """{"message":"Not Found"}"""));
        }
    }

    private sealed class FakeCache : IDistributedCache
    {
        private readonly Dictionary<string, byte[]> _store = new();

        public byte[]? Get(string key) => _store.TryGetValue(key, out var v) ? v : null;
        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) => Task.FromResult(Get(key));
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options) => _store[key] = value;
        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default)
        {
            _store[key] = value;
            return Task.CompletedTask;
        }
        public void Refresh(string key) { }
        public Task RefreshAsync(string key, CancellationToken token = default) => Task.CompletedTask;
        public void Remove(string key) => _store.Remove(key);
        public Task RemoveAsync(string key, CancellationToken token = default)
        {
            _store.Remove(key);
            return Task.CompletedTask;
        }
    }
}
