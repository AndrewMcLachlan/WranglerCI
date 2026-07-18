namespace Asm.Wrangler.Api.Models.Attention;

/// <summary>
/// Categorisation of an item surfaced by the unified attention feed.
/// </summary>
public enum AttentionItemType
{
    /// <summary>A workflow whose most recent run on the default branch failed.</summary>
    WorkflowFailure,
    /// <summary>A pull request where the current user is a requested reviewer.</summary>
    PullRequestReview,
    /// <summary>Open security alerts (Dependabot, code scanning, or secret scanning) on a repository.</summary>
    SecurityAlert,
}

/// <summary>
/// A single thing the current user might want to act on, surfaced across
/// selected repositories by the attention feed.
/// </summary>
public record AttentionItem
{
    public required AttentionItemType Type { get; init; }
    public required string RepositoryOwner { get; init; }
    public required string RepositoryName { get; init; }

    /// <summary>The human-readable headline for the item.</summary>
    public required string Title { get; init; }

    /// <summary>Where to go on github.com to handle the item.</summary>
    public required string HtmlUrl { get; init; }

    /// <summary>When the item became relevant (run finish time, PR update time, etc.).</summary>
    public required DateTimeOffset OccurredAt { get; init; }

    public long? WorkflowRunId { get; init; }
    public string? WorkflowName { get; init; }
    public string? Branch { get; init; }

    public int? PullRequestNumber { get; init; }
    public string? PullRequestAuthor { get; init; }

    /// <summary>The number of open alerts (SecurityAlert items only).</summary>
    public int? AlertCount { get; init; }

    /// <summary>The highest alert severity: critical | high | medium | low (SecurityAlert items only).</summary>
    public string? AlertSeverity { get; init; }

    /// <summary>The alert category: Dependabot, Code scanning, or Secret scanning (SecurityAlert items only).</summary>
    public string? AlertCategory { get; init; }
}
