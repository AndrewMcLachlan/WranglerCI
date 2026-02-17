namespace GitHubActionsDashboard.Api.Models;

/// <summary>
/// Red/Amber/Green traffic-light status indicator.
/// </summary>
public enum RagStatus
{
    /// <summary>
    /// No status available.
    /// </summary>
    None,

    /// <summary>
    /// One or more items have failed.
    /// </summary>
    Red,

    /// <summary>
    /// One or more items require attention.
    /// </summary>
    Amber,

    /// <summary>
    /// All items are successful.
    /// </summary>
    Green,
}
