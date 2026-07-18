using Asm.Wrangler.Api.Models.Security;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Reads open security alerts (Dependabot, code scanning, secret scanning) for a
/// repository and reduces them to per-category summaries (issue #145).
/// </summary>
public interface ISecurityAlertsService
{
    /// <summary>
    /// Returns a summary per alert category that has open alerts. Categories that
    /// are disabled, inaccessible, or unsupported by the current token are omitted.
    /// </summary>
    Task<IEnumerable<SecurityAlertSummary>> GetOpenAlertSummariesAsync(string owner, string repo, CancellationToken cancellationToken);
}

internal class SecurityAlertsService(IGitHubClient gitHubClient, IDistributedCache cache, ICacheKeyService cacheKeyService, ILogger<SecurityAlertsService> logger)
    : GitHubService(cache, logger), ISecurityAlertsService
{
    private readonly SemaphoreSlim _gate = new(8);

    private static readonly IReadOnlyDictionary<string, int> SeverityRank = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["critical"] = 4,
        ["high"] = 3,
        ["medium"] = 2,
        ["moderate"] = 2,
        ["low"] = 1,
    };

    public async Task<IEnumerable<SecurityAlertSummary>> GetOpenAlertSummariesAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var cacheKey = cacheKeyService.GetCacheKey($"gh:security-alerts:{owner}/{repo}");

        var cached = await TryGetFromCache<SecurityAlertSummary>(cacheKey, cancellationToken);
        if (cached != null)
        {
            return cached;
        }

        var summaries = new List<SecurityAlertSummary>();

        var dependabot = await GetDependabotSummaryAsync(owner, repo, cancellationToken);
        if (dependabot != null) summaries.Add(dependabot);

        var codeScanning = await GetCodeScanningSummaryAsync(owner, repo, cancellationToken);
        if (codeScanning != null) summaries.Add(codeScanning);

        var secretScanning = await GetSecretScanningSummaryAsync(owner, repo, cancellationToken);
        if (secretScanning != null) summaries.Add(secretScanning);

        await TryCache(cacheKey, summaries, cancellationToken);

        return summaries;
    }

    private async Task<SecurityAlertSummary?> GetDependabotSummaryAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var alerts = await GetAlertsAsync<DependabotAlertResponse>($"repos/{owner}/{repo}/dependabot/alerts", cancellationToken);
        if (alerts.Length == 0) return null;

        return new SecurityAlertSummary
        {
            Category = "Dependabot",
            Count = alerts.Length,
            HighestSeverity = HighestSeverity(alerts.Select(a => a.SecurityAdvisory?.Severity)),
            NewestAt = alerts.Max(a => a.UpdatedAt),
            HtmlUrl = $"https://github.com/{owner}/{repo}/security/dependabot",
        };
    }

    private async Task<SecurityAlertSummary?> GetCodeScanningSummaryAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var alerts = await GetAlertsAsync<CodeScanningAlertResponse>($"repos/{owner}/{repo}/code-scanning/alerts", cancellationToken);
        if (alerts.Length == 0) return null;

        return new SecurityAlertSummary
        {
            Category = "Code scanning",
            Count = alerts.Length,
            HighestSeverity = HighestSeverity(alerts.Select(a => a.Rule?.SecuritySeverityLevel)),
            NewestAt = alerts.Max(a => a.UpdatedAt),
            HtmlUrl = $"https://github.com/{owner}/{repo}/security/code-scanning",
        };
    }

    private async Task<SecurityAlertSummary?> GetSecretScanningSummaryAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var alerts = await GetAlertsAsync<SecretScanningAlertResponse>($"repos/{owner}/{repo}/secret-scanning/alerts", cancellationToken);
        if (alerts.Length == 0) return null;

        return new SecurityAlertSummary
        {
            Category = "Secret scanning",
            // Secret scanning alerts carry no severity; an exposed secret is
            // serious, so surface it as "high".
            Count = alerts.Length,
            HighestSeverity = "high",
            NewestAt = alerts.Max(a => a.UpdatedAt),
            HtmlUrl = $"https://github.com/{owner}/{repo}/security/secret-scanning",
        };
    }

    private async Task<T[]> GetAlertsAsync<T>(string path, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var parameters = new Dictionary<string, string> { ["state"] = "open", ["per_page"] = "100" };
            var response = await OctoCall(() => gitHubClient.Connection.Get<T[]>(
                new Uri(path, UriKind.Relative), parameters, null, cancellationToken), cancellationToken);
            return response.Body ?? [];
        }
        catch (NotFoundException)
        {
            // The feature is disabled for this repo, or the repo isn't accessible.
            return [];
        }
        catch (ForbiddenException)
        {
            // Insufficient scope (e.g. code scanning on a private repo without
            // security_events) or access — degrade quietly rather than failing
            // the whole attention feed.
            logger.LogDebug("Security alert read forbidden for {Path}; skipping category.", path);
            return [];
        }
        finally
        {
            _gate.Release();
        }
    }

    private static string HighestSeverity(IEnumerable<string?> severities)
    {
        string? best = null;
        var bestRank = 0;
        foreach (var severity in severities)
        {
            if (severity != null && SeverityRank.TryGetValue(severity, out var rank) && rank > bestRank)
            {
                bestRank = rank;
                best = severity.ToLowerInvariant();
            }
        }
        return best ?? "low";
    }
}
