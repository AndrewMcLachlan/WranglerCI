using Asm.Wrangler.Api.Models.PullRequests;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Decides what stops Wrangler merging a pull request for the current user.
/// </summary>
internal static class MergeBlockers
{
    public static IReadOnlyList<MergeBlocker> For(MergeState? state, ReviewDecision? review, int unresolvedThreads, bool isOwnPullRequest, bool isDraft = false)
    {
        List<MergeBlocker> blockers = [];

        // GitHub no longer reports Draft as a merge state, so the pull request's own flag decides.
        if (isDraft || state == MergeState.Draft) blockers.Add(MergeBlocker.Draft);
        if (state == MergeState.Dirty) blockers.Add(MergeBlocker.Conflict);
        if (state == MergeState.Behind) blockers.Add(MergeBlocker.Behind);
        if (review == ReviewDecision.ChangesRequested) blockers.Add(MergeBlocker.ChangesRequested);
        if (review == ReviewDecision.ReviewRequired && isOwnPullRequest) blockers.Add(MergeBlocker.NeedsReview);
        if (state == MergeState.Blocked && unresolvedThreads > 0) blockers.Add(MergeBlocker.UnresolvedConversations);

        // Someone else's PR awaiting review reports Blocked until Wrangler's own approval lands.
        var awaitsOurApproval = review == ReviewDecision.ReviewRequired && !isOwnPullRequest;
        if (state == MergeState.Blocked && blockers.Count == 0 && !awaitsOurApproval) blockers.Add(MergeBlocker.Blocked);

        return blockers;
    }

    /// <summary>
    /// Whether merging needs Wrangler to approve first. GitHub refuses an approval of your own pull request.
    /// </summary>
    public static bool NeedsApproval(ReviewDecision? review, bool isOwnPullRequest) =>
        !isOwnPullRequest && review != ReviewDecision.Approved;
}
