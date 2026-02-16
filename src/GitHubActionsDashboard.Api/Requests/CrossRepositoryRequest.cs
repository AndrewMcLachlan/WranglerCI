namespace GitHubActionsDashboard.Api.Requests;

/// <summary>
/// Request identifying repositories grouped by owner.
/// </summary>
public record CrossRepositoryRequest
{
    /// <summary>
    /// A dictionary mapping owner logins to their repository names.
    /// </summary>
    public Dictionary<string, List<string>> Repositories { get; init;  } = [];
}
