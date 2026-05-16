namespace Asm.Wrangler.Api.Webhooks;

/// <summary>
/// Per-(owner, repo, kind) freshness stamps used to invalidate cached GitHub
/// responses when a webhook reports a change. A monotonic stamp is folded
/// into cache keys so bumping it orphans the previous entries naturally.
/// </summary>
public interface IRepoVersionService
{
    /// <summary>
    /// Returns the current stamp, or 0 when no bump has been recorded.
    /// </summary>
    Task<long> GetVersionAsync(string owner, string repo, RepoDataKind kind, CancellationToken cancellationToken);

    /// <summary>
    /// Records a fresh stamp so subsequent cache reads miss and re-fetch.
    /// </summary>
    Task BumpAsync(string owner, string repo, RepoDataKind kind, CancellationToken cancellationToken);
}
