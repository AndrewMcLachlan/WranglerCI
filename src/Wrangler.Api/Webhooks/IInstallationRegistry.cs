namespace Asm.Wrangler.Api.Webhooks;

/// <summary>
/// Metadata for a GitHub App installation on a user or organisation account.
/// </summary>
public record InstallationInfo
{
    public required string Account { get; init; }
    public required long AccountId { get; init; }
    /// <summary>"User" or "Organization".</summary>
    public required string Type { get; init; }
    public DateTimeOffset? SuspendedAt { get; init; }
}

/// <summary>
/// Tracks GitHub App installations and which repositories each covers.
/// Backed by the distributed cache (Redis in prod, in-memory in dev).
/// </summary>
public interface IInstallationRegistry
{
    Task SaveInstallationAsync(long installationId, InstallationInfo info, IEnumerable<string> repos, CancellationToken cancellationToken);

    Task RemoveInstallationAsync(long installationId, CancellationToken cancellationToken);

    Task SetSuspendedAsync(long installationId, bool suspended, CancellationToken cancellationToken);

    Task AddRepositoriesAsync(long installationId, IEnumerable<string> repos, CancellationToken cancellationToken);

    Task RemoveRepositoriesAsync(long installationId, IEnumerable<string> repos, CancellationToken cancellationToken);

    Task<long?> GetInstallationIdForRepoAsync(string owner, string repo, CancellationToken cancellationToken);

    /// <summary>
    /// Atomically records that a webhook delivery has been processed.
    /// Returns <c>true</c> on the first call for a given delivery ID,
    /// <c>false</c> on subsequent calls within the dedupe window.
    /// </summary>
    Task<bool> TryClaimDeliveryAsync(string deliveryId, CancellationToken cancellationToken);
}
