namespace GitHubActionsDashboard.Api.Requests;

/// <summary>
/// Request containing branch filter patterns.
/// </summary>
public record BranchFilterRequest
{
    /// <summary>
    /// The branch name patterns to filter by. Supports trailing wildcards (e.g. "release/*").
    /// </summary>
    public IEnumerable<string> BranchFilters { get; init; } = [];
}
