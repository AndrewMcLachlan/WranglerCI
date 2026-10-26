using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Services;
using Xunit;

namespace Wrangler.Tests;

public class MergeBlockersTests
{
    [Theory]
    [InlineData(MergeState.Clean, null, false)]
    [InlineData(MergeState.Clean, null, true)]
    [InlineData(MergeState.HasHooks, ReviewDecision.Approved, true)]
    [InlineData(MergeState.Unstable, ReviewDecision.Approved, false)]
    [InlineData(MergeState.Unknown, null, false)]
    public void Nothing_blocks_a_mergeable_pull_request(MergeState state, ReviewDecision? review, bool isOwn) =>
        Assert.Empty(MergeBlockers.For(state, review, 0, isOwn));

    [Fact]
    public void Someone_elses_pull_request_awaiting_review_is_left_for_Wrangler_to_approve() =>
        Assert.Empty(MergeBlockers.For(MergeState.Blocked, ReviewDecision.ReviewRequired, 0, isOwnPullRequest: false));

    [Fact]
    public void Your_own_pull_request_awaiting_review_needs_someone_else() =>
        Assert.Equal([MergeBlocker.NeedsReview], MergeBlockers.For(MergeState.Blocked, ReviewDecision.ReviewRequired, 0, isOwnPullRequest: true));

    [Fact]
    public void Your_own_approved_pull_request_can_be_merged() =>
        Assert.Empty(MergeBlockers.For(MergeState.Clean, ReviewDecision.Approved, 0, isOwnPullRequest: true));

    [Theory]
    [InlineData(MergeState.Dirty, MergeBlocker.Conflict)]
    [InlineData(MergeState.Behind, MergeBlocker.Behind)]
    [InlineData(MergeState.Draft, MergeBlocker.Draft)]
    public void The_merge_state_names_its_blocker(MergeState state, MergeBlocker expected) =>
        Assert.Equal([expected], MergeBlockers.For(state, ReviewDecision.Approved, 0, isOwnPullRequest: false));

    [Fact]
    public void A_draft_shows_as_a_draft_rather_than_blocked() =>
        Assert.Equal([MergeBlocker.Draft], MergeBlockers.For(MergeState.Blocked, ReviewDecision.Approved, 0, isOwnPullRequest: false, isDraft: true));

    [Fact]
    public void A_draft_shows_before_GitHub_reports_its_status() =>
        Assert.Equal([MergeBlocker.Draft], MergeBlockers.For(null, null, 0, isOwnPullRequest: true, isDraft: true));

    [Fact]
    public void Requested_changes_block_whoever_wrote_it() =>
        Assert.Contains(MergeBlocker.ChangesRequested, MergeBlockers.For(MergeState.Blocked, ReviewDecision.ChangesRequested, 0, isOwnPullRequest: false));

    [Fact]
    public void Unresolved_conversations_block_only_when_GitHub_reports_the_merge_blocked()
    {
        Assert.Equal([MergeBlocker.UnresolvedConversations], MergeBlockers.For(MergeState.Blocked, ReviewDecision.Approved, 2, isOwnPullRequest: false));
        Assert.Empty(MergeBlockers.For(MergeState.Clean, ReviewDecision.Approved, 2, isOwnPullRequest: false));
    }

    [Fact]
    public void A_block_with_no_reported_reason_still_shows() =>
        Assert.Equal([MergeBlocker.Blocked], MergeBlockers.For(MergeState.Blocked, ReviewDecision.Approved, 0, isOwnPullRequest: true));

    [Theory]
    [InlineData(null, false, true)]
    [InlineData(ReviewDecision.ReviewRequired, false, true)]
    [InlineData(ReviewDecision.Approved, false, false)]
    [InlineData(ReviewDecision.Approved, true, false)]
    [InlineData(ReviewDecision.ReviewRequired, true, false)]
    public void Approves_only_someone_elses_unapproved_pull_request(ReviewDecision? review, bool isOwn, bool expected) =>
        Assert.Equal(expected, MergeBlockers.NeedsApproval(review, isOwn));
}
