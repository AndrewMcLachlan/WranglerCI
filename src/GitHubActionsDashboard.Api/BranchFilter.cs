namespace GitHubActionsDashboard.Api;

/// <summary>
/// Provides branch name matching against filter patterns.
/// </summary>
public static class BranchFilter
{
    /// <summary>
    /// Determines whether a branch name matches any of the specified filter patterns.
    /// Supports exact matches and trailing wildcard patterns (e.g. "release/*").
    /// Returns <c>true</c> if no filters are specified.
    /// </summary>
    public static bool Match(string branchName, IEnumerable<string> branchFilters)
    {
        if (!branchFilters.Any()) return true;

        if (branchFilters.Contains(branchName)) return true;

        var startsWith = branchFilters.Where(b => b.EndsWith('*')).Select(b => b.Trim('*'));

        return startsWith.Any(branchName.StartsWith);
    }
}
