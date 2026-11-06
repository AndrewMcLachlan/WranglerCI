namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Which open pull requests a list shows, and the cache key segment that identifies that choice.
/// </summary>
internal sealed record PullRequestFilter(string CacheKey, Func<string, bool, IReadOnlyList<string>, bool> Predicate)
{
    /// <summary>Pull requests opened by a bot account, such as Dependabot or Renovate.</summary>
    public static readonly PullRequestFilter Bots = new("bots:", (_, authorIsBot, _) => authorIsBot);

    /// <summary>Pull requests opened by any of <paramref name="authors"/> (case-insensitive), or every pull request when <paramref name="authors"/> is empty.</summary>
    public static PullRequestFilter ByAuthors(IReadOnlyList<string> authors) =>
        new(String.Join(',', authors.Select(a => a.ToLowerInvariant()).Order()),
            (author, _, _) => authors.Count == 0 || authors.Any(a => Same(a, author)));

    /// <summary>
    /// Pull requests assigned to <paramref name="viewer"/>, whoever opened them, and those <paramref name="viewer"/>
    /// opened that nobody is assigned to.
    /// </summary>
    public static PullRequestFilter Mine(string viewer) =>
        new($"mine:{viewer.ToLowerInvariant()}",
            (author, _, assignees) => assignees.Any(a => Same(a, viewer)) || (assignees.Count == 0 && Same(author, viewer)));

    /// <summary>Whether a pull request with this author and these assignees belongs in the list.</summary>
    public bool Matches(string author, bool authorIsBot, IReadOnlyList<string> assignees) => Predicate(author, authorIsBot, assignees);

    private static bool Same(string a, string b) => String.Equals(a, b, StringComparison.OrdinalIgnoreCase);
}
