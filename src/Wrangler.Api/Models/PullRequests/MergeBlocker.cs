namespace Asm.Wrangler.Api.Models.PullRequests;

/// <summary>
/// A reason Wrangler cannot merge a pull request for the current user.
/// </summary>
public enum MergeBlocker
{
    /// <summary>
    /// It is a draft.
    /// </summary>
    Draft,

    /// <summary>
    /// It has merge conflicts.
    /// </summary>
    Conflict,

    /// <summary>
    /// The branch must be brought up to date with its base first.
    /// </summary>
    Behind,

    /// <summary>
    /// A reviewer has requested changes.
    /// </summary>
    ChangesRequested,

    /// <summary>
    /// It is the current user's own pull request, which they cannot approve, and it has no approval yet.
    /// </summary>
    NeedsReview,

    /// <summary>
    /// Review conversations are unresolved and the branch requires them resolved.
    /// </summary>
    UnresolvedConversations,

    /// <summary>
    /// A branch rule blocks it for a reason GitHub does not report, such as a failing required check.
    /// </summary>
    Blocked,
}
