namespace Asm.Wrangler.Api.Models.PullRequests;

/// <summary>
/// Where a pull request stands against the branch's review requirements.
/// </summary>
public enum ReviewDecision
{
    /// <summary>
    /// The required reviews have approved it.
    /// </summary>
    Approved,

    /// <summary>
    /// A reviewer has requested changes.
    /// </summary>
    ChangesRequested,

    /// <summary>
    /// A review is required and none has approved it yet.
    /// </summary>
    ReviewRequired,
}
