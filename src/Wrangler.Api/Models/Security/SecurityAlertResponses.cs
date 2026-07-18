namespace Asm.Wrangler.Api.Models.Security;

// Minimal shapes of GitHub's security alert REST payloads. Octokit 14 has no
// typed clients for these endpoints, so we deserialize the snake_case JSON onto
// these PascalCase records via Octokit's serializer (same approach as
// PendingDeploymentResponse). Only the fields we actually need are declared.

/// <summary>A Dependabot alert (subset of fields).</summary>
public record DependabotAlertResponse
{
    public string? State { get; init; }
    public DependabotSecurityAdvisory? SecurityAdvisory { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>The advisory attached to a Dependabot alert.</summary>
public record DependabotSecurityAdvisory
{
    /// <summary>low | medium | high | critical.</summary>
    public string? Severity { get; init; }
}

/// <summary>A code scanning alert (subset of fields).</summary>
public record CodeScanningAlertResponse
{
    public string? State { get; init; }
    public CodeScanningRule? Rule { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>The rule that raised a code scanning alert.</summary>
public record CodeScanningRule
{
    /// <summary>low | medium | high | critical (when a security severity is assigned).</summary>
    public string? SecuritySeverityLevel { get; init; }

    /// <summary>Fallback rule severity: error | warning | note.</summary>
    public string? Severity { get; init; }
}

/// <summary>A secret scanning alert (subset of fields). Secrets carry no severity.</summary>
public record SecretScanningAlertResponse
{
    public string? State { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
