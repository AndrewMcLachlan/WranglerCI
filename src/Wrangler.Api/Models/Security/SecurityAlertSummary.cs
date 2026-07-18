namespace Asm.Wrangler.Api.Models.Security;

/// <summary>
/// A per-repository, per-category summary of open security alerts, used to
/// surface a "you have N alerts" signal without listing every individual alert.
/// </summary>
public record SecurityAlertSummary
{
    /// <summary>The alert category: "Dependabot", "Code scanning", or "Secret scanning".</summary>
    public required string Category { get; init; }

    /// <summary>The number of open alerts in this category.</summary>
    public required int Count { get; init; }

    /// <summary>The highest severity among the open alerts: critical | high | medium | low.</summary>
    public required string HighestSeverity { get; init; }

    /// <summary>When the most recently updated open alert changed.</summary>
    public required DateTimeOffset NewestAt { get; init; }

    /// <summary>The repository's GitHub security page for this category.</summary>
    public required string HtmlUrl { get; init; }
}
