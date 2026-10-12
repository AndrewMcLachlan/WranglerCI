using System.Net;
using Asm.Wrangler.Api.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Octokit;
using Octokit.Caching;
using Octokit.Internal;

namespace Asm.Wrangler.Tests;

/// <summary>
/// Octokit's <c>CachingHttpClient</c> never serves an entry from here on its own: it reads one only
/// to put its ETag in an <c>If-None-Match</c> header, and reuses the body solely when GitHub answers
/// 304. So an entry cannot go stale, and losing one cannot make a response fresher — it only turns a
/// conditional request, which GitHub does not charge to the primary rate limit, into an unconditional
/// one that it does. These tests pin the two properties that keep that working: a key that depends on
/// nothing but the request, and an ETag that survives the round trip.
/// </summary>
public class DistributedResponseCacheTests
{
    private const string PendingDeployments = "/repos/owner/repo/actions/runs/99/pending_deployments";

    // Regression guard for the per-repo version stamp this key used to carry. Webhooks bump those
    // stamps constantly — check_run alone fires once per job — so every bump orphaned the stored
    // ETag and the next poll of an unchanged gate paid full rate-limit price for a 200 instead of
    // going free on a 304.
    [Fact]
    public async Task Cache_key_carries_no_repo_version_stamp()
    {
        var cache = new RecordingCache();
        var responseCache = Create(cache);

        await responseCache.SetAsync(Request(PendingDeployments), Response("\"etag-1\""));

        var key = Assert.Single(cache.Keys);
        Assert.Contains(PendingDeployments, key);
        Assert.DoesNotContain(":v", key);
    }

    [Fact]
    public async Task Round_trips_the_etag_a_conditional_request_needs()
    {
        var cache = new RecordingCache();
        var responseCache = Create(cache);
        var request = Request(PendingDeployments);

        await responseCache.SetAsync(request, Response("\"etag-1\""));
        var cached = await responseCache.GetAsync(request);

        Assert.NotNull(cached);
        Assert.Equal("\"etag-1\"", cached.ApiInfo.Etag);
    }

    [Fact]
    public async Task Different_endpoints_do_not_share_an_entry()
    {
        var cache = new RecordingCache();
        var responseCache = Create(cache);

        await responseCache.SetAsync(Request(PendingDeployments), Response("\"etag-1\""));

        Assert.Null(await responseCache.GetAsync(Request("/repos/owner/repo/actions/runs/100/pending_deployments")));
    }

    [Fact]
    public async Task Different_query_parameters_do_not_share_an_entry()
    {
        var cache = new RecordingCache();
        var responseCache = Create(cache);

        await responseCache.SetAsync(Request("/repos/owner/repo/actions/runs", ("status", "waiting")), Response("\"etag-1\""));

        Assert.Null(await responseCache.GetAsync(Request("/repos/owner/repo/actions/runs", ("status", "completed"))));
    }

    // Parameter order is an implementation detail of the caller, not a different request.
    [Fact]
    public async Task Parameter_order_does_not_change_the_entry()
    {
        var cache = new RecordingCache();
        var responseCache = Create(cache);

        await responseCache.SetAsync(Request("/repos/owner/repo/actions/runs", ("status", "waiting"), ("per_page", "100")), Response("\"etag-1\""));
        var cached = await responseCache.GetAsync(Request("/repos/owner/repo/actions/runs", ("per_page", "100"), ("status", "waiting")));

        Assert.NotNull(cached);
    }

    private static DistributedResponseCache Create(IDistributedCache cache) =>
        new(cache, new FakeCacheKeyService(), NullLogger<DistributedResponseCache>.Instance);

    private static IRequest Request(string endpoint, params (string Key, string Value)[] parameters)
    {
        var request = new Octokit.Internal.Request
        {
            Method = HttpMethod.Get,
            Endpoint = new Uri(endpoint, UriKind.Relative),
            BaseAddress = new Uri("https://api.github.com"),
        };
        foreach (var (key, value) in parameters) request.Parameters.Add(key, value);
        return request;
    }

    private static CachedResponse.V1 Response(string etag) =>
        new(
            body: "[]",
            headers: new Dictionary<string, string> { ["ETag"] = etag },
            apiInfo: new ApiInfo(new Dictionary<string, Uri>(), [], [], etag, rateLimit: null),
            statusCode: HttpStatusCode.OK,
            contentType: "application/json");

    private sealed class FakeCacheKeyService : ICacheKeyService
    {
        public string GetCacheKey(string key) => $"user-hash:{key}";
    }

    private sealed class RecordingCache : IDistributedCache
    {
        private readonly Dictionary<string, byte[]> _store = [];

        public List<string> Keys { get; } = [];

        public byte[]? Get(string key) => _store.TryGetValue(key, out var value) ? value : null;
        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) => Task.FromResult(Get(key));
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options)
        {
            Keys.Add(key);
            _store[key] = value;
        }
        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default)
        {
            Set(key, value, options);
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
