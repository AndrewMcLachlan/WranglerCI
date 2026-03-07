namespace Asm.Wrangler.Api.Models.Settings;

/// <summary>
/// Represents a repository in the settings context, including its available workflows.
/// </summary>
public record SettingsRepositoryModel : RepositoryBase
{
    /// <summary>
    /// The full name of the repository (owner/name).
    /// </summary>
    public required string FullName { get; init; }

    /// <summary>
    /// The workflows available in this repository.
    /// </summary>
    public IList<WorkflowBase> Workflows { get; init; } = [];
}
