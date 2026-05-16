using Microsoft.Extensions.Caching.Distributed;

namespace Asm.Wrangler.Api.Webhooks;

internal class RepoVersionService(IDistributedCache cache) : IRepoVersionService
{
    private static string KindToken(RepoDataKind kind) => kind switch
    {
        RepoDataKind.Workflows => "workflows",
        RepoDataKind.WorkflowRuns => "workflow_runs",
        RepoDataKind.Pulls => "pulls",
        RepoDataKind.Checks => "checks",
        _ => throw new ArgumentOutOfRangeException(nameof(kind)),
    };

    private static string Key(string owner, string repo, RepoDataKind kind) => $"gh:ver:{owner}/{repo}:{KindToken(kind)}";

    public async Task<long> GetVersionAsync(string owner, string repo, RepoDataKind kind, CancellationToken cancellationToken)
    {
        var value = await cache.GetStringAsync(Key(owner, repo, kind), cancellationToken);
        return Int64.TryParse(value, out var version) ? version : 0L;
    }

    public Task BumpAsync(string owner, string repo, RepoDataKind kind, CancellationToken cancellationToken)
    {
        // Monotonic-enough: two simultaneous bumps both write the current
        // milliseconds; whichever wins is still strictly greater than what
        // came before, which is all the cache key needs.
        var stamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        return cache.SetStringAsync(Key(owner, repo, kind), stamp, cancellationToken);
    }
}
