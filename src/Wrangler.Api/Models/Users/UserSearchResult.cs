namespace Asm.Wrangler.Api.Models.Users;

/// <summary>
/// A GitHub user returned from the pull-request author-search typeahead.
/// </summary>
public record UserSearchResult
{
    /// <summary>The user's GitHub login.</summary>
    public required string Login { get; init; }

    /// <summary>The user's display name, if GitHub has one for them.</summary>
    public string? Name { get; init; }

    /// <summary>URL of the user's avatar image.</summary>
    public string? AvatarUrl { get; init; }
}
