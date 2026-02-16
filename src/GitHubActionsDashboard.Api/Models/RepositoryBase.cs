namespace GitHubActionsDashboard.Api.Models;

/// <summary>
/// Base record containing common repository properties.
/// </summary>
public record RepositoryBase
{
    /// <summary>
    /// The repository name.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// The repository owner (user or organisation login).
    /// </summary>
    public required string Owner { get; init; }

    /// <summary>
    /// The GraphQL node ID.
    /// </summary>
    public required string NodeId { get; init; }

    /// <summary>
    /// The URL to view the repository on GitHub.
    /// </summary>
    public required string HtmlUrl { get; init; }
}
