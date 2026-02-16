namespace GitHubActionsDashboard.Api.Models.Settings;

/// <summary>
/// Represents a GitHub account (user or organisation) with its repositories.
/// </summary>
public record AccountModel
{
    /// <summary>
    /// The account login name.
    /// </summary>
    public required string Login { get; init; }

    /// <summary>
    /// The URL of the account's avatar image.
    /// </summary>
    public required string AvatarUrl { get; init; }

    /// <summary>
    /// The URL to view the account on GitHub.
    /// </summary>
    public required string HtmlUrl { get; init; }

    /// <summary>
    /// The type of account (User or Organization).
    /// </summary>
    public Octokit.AccountType? Type { get; init; }

    /// <summary>
    /// The repositories belonging to this account.
    /// </summary>
    public IList<SettingsRepositoryModel> Repositories { get; init; } = [];
}
