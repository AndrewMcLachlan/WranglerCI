namespace Asm.Wrangler.Api.Models.PullRequests;

/// <summary>
/// GitHub's view of whether a pull request can be merged now.
/// </summary>
public enum MergeState
{
    /// <summary>
    /// The head ref is out of date with the base branch.
    /// </summary>
    Behind,

    /// <summary>
    /// A branch rule blocks the merge, such as a missing review or an unresolved conversation.
    /// </summary>
    Blocked,

    /// <summary>
    /// It can be merged.
    /// </summary>
    Clean,

    /// <summary>
    /// The merge commit cannot be created cleanly: there are conflicts.
    /// </summary>
    Dirty,

    /// <summary>
    /// It is a draft.
    /// </summary>
    Draft,

    /// <summary>
    /// It can be merged and the repository has pre-receive hooks.
    /// </summary>
    HasHooks,

    /// <summary>
    /// GitHub has not computed it yet.
    /// </summary>
    Unknown,

    /// <summary>
    /// It can be merged, but a check that isn't required has failed.
    /// </summary>
    Unstable,
}
