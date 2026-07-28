using System.Net;
using System.Text;
using Asm.Wrangler.Api.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Octokit;
using Octokit.Internal;
using Xunit;

namespace Wrangler.Tests;

public class RepositoryAccessServiceTests
{
    [Fact]
    public async Task Returns_true_and_caches_when_repo_is_accessible()
    {
        var handler = new StubHandler(_ => Json(HttpStatusCode.OK,
            """{"id":1,"name":"repo","full_name":"owner/repo","owner":{"login":"owner","id":1}}"""));
        var cache = new FakeCache();
        var service = Service(handler, cache);

        Assert.True(await service.CanAccessAsync("owner", "repo", CancellationToken.None));
        Assert.Equal("1", await cache.GetStringAsync("u:repoaccess:owner/repo"));
    }

    [Fact]
    public async Task Returns_false_and_caches_when_repo_is_not_accessible()
    {
        // GitHub returns 404 for a private repo the user can't see.
        var handler = new StubHandler(_ => Json(HttpStatusCode.NotFound, """{"message":"Not Found"}"""));
        var cache = new FakeCache();
        var service = Service(handler, cache);

        Assert.False(await service.CanAccessAsync("owner", "repo", CancellationToken.None));
        Assert.Equal("0", await cache.GetStringAsync("u:repoaccess:owner/repo"));
    }

    [Fact]
    public async Task Uses_cached_decision_without_calling_github()
    {
        var handler = new StubHandler(_ => throw new InvalidOperationException("GitHub must not be called on a cache hit."));
        var cache = new FakeCache();
        await cache.SetStringAsync("u:repoaccess:owner/repo", "1");
        var service = Service(handler, cache);

        Assert.True(await service.CanAccessAsync("owner", "repo", CancellationToken.None));
        Assert.Equal(0, handler.Calls);
    }

    private static RepositoryAccessService Service(StubHandler handler, IDistributedCache cache)
    {
        var connection = new Connection(new ProductHeaderValue("wrangler-tests"), new HttpClientAdapter(() => handler));
        return new RepositoryAccessService(new GitHubClient(connection), cache, new FakeCacheKeys(), NullLogger<RepositoryAccessService>.Instance);
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private sealed class FakeCacheKeys : ICacheKeyService
    {
        public string GetCacheKey(string key) => "u:" + key;
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
