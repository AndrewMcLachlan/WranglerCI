namespace Asm.Wrangler.Api.Models;

/// <summary>
/// Status indicator for workflow runs, workflows, and repositories.
/// </summary>
public enum WorkflowStatus
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

    /// <summary>
    /// One or more items are currently running.
    /// </summary>
    Running,

    /// <summary>
    /// One or more items are waiting.
    /// </summary>
    Waiting,
}
