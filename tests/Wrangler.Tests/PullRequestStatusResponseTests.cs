using Asm.Wrangler.Api.GraphQL;
using Asm.Wrangler.Api.Models.PullRequests;
using Octokit.Internal;
using Xunit;

namespace Wrangler.Tests;

/// <summary>
/// The response goes through Octokit's own serializer, which binds only snake_case, so the query
/// aliases every multi-word field.
/// </summary>
public class PullRequestStatusResponseTests
{
    [Fact]
    public void Reads_each_pull_requests_status()
    {
        const string json = """
            {"data":{"repository":{"pull_requests":{"nodes":[
              {"number":12,"review_decision":"CHANGES_REQUESTED","merge_state_status":"BLOCKED","review_threads":{"nodes":[{"is_resolved":false},{"is_resolved":true},{"is_resolved":false}]},"commits":{"nodes":[{"commit":{"status_check_rollup":{"state":"FAILURE"}}}]}},
              {"number":13,"review_decision":"APPROVED","merge_state_status":"HAS_HOOKS","review_threads":{"nodes":[{"is_resolved":true}]},"commits":{"nodes":[{"commit":{"status_check_rollup":{"state":"SUCCESS"}}}]}},
              {"number":14,"review_decision":null,"merge_state_status":"DIRTY","review_threads":{"nodes":[]},"commits":{"nodes":[{"commit":{"status_check_rollup":{"state":"PENDING"}}}]}}
            ]}}}}
            """;

        var statuses = new SimpleJsonSerializer().Deserialize<PullRequestStatusResponse>(json).ByNumber();

        Assert.Equal(new PullRequestStatus(2, ReviewDecision.ChangesRequested, MergeState.Blocked, CheckStatus.Failure), statuses[12]);
        Assert.Equal(new PullRequestStatus(0, ReviewDecision.Approved, MergeState.HasHooks, CheckStatus.Success), statuses[13]);
        Assert.Equal(new PullRequestStatus(0, null, MergeState.Dirty, CheckStatus.Pending), statuses[14]);
    }

    [Theory]
    [InlineData("""{"status_check_rollup":{"state":"ERROR"}}""", CheckStatus.Failure)]
    [InlineData("""{"status_check_rollup":{"state":"EXPECTED"}}""", CheckStatus.Pending)]
    [InlineData("""{"status_check_rollup":null}""", CheckStatus.Success)]
    [InlineData("null", CheckStatus.Unknown)]
    public void Reads_the_head_commits_check_status(string commit, CheckStatus expected)
    {
        var json = """{"data":{"repository":{"pull_requests":{"nodes":[{"number":1,"commits":{"nodes":[{"commit":""" + commit + """}]}}]}}}}""";

        Assert.Equal(expected, new SimpleJsonSerializer().Deserialize<PullRequestStatusResponse>(json).ByNumber()[1].CheckStatus);
    }

    [Fact]
    public void Reads_where_the_next_page_starts()
    {
        const string json = """{"data":{"repository":{"pull_requests":{"page_info":{"has_next_page":true,"end_cursor":"Y3Vyc29y"},"nodes":[]}}}}""";

        Assert.Equal("Y3Vyc29y", new SimpleJsonSerializer().Deserialize<PullRequestStatusResponse>(json).NextCursor);
    }

    [Fact]
    public void Has_no_next_page_on_the_last_page()
    {
        const string json = """{"data":{"repository":{"pull_requests":{"page_info":{"has_next_page":false,"end_cursor":"Y3Vyc29y"},"nodes":[]}}}}""";

        Assert.Null(new SimpleJsonSerializer().Deserialize<PullRequestStatusResponse>(json).NextCursor);
    }

    [Fact]
    public void Reports_nothing_when_GitHub_returns_errors_instead_of_data()
    {
        const string json = """{"data":null,"errors":[{"message":"Could not resolve to a Repository"}]}""";

        var response = new SimpleJsonSerializer().Deserialize<PullRequestStatusResponse>(json);

        Assert.Empty(response.ByNumber());
    }

    [Fact]
    public void Reads_the_merge_context()
    {
        const string json = """{"data":{"repository":{"pull_request":{"number":7,"author":{"login":"ada"},"review_decision":"REVIEW_REQUIRED"}}}}""";

        var pullRequest = new SimpleJsonSerializer().Deserialize<MergeContextResponse>(json).Data!.Repository!.PullRequest!;

        Assert.Equal("ada", pullRequest.Author!.Login);
        Assert.Equal(ReviewDecision.ReviewRequired, pullRequest.ToStatus().ReviewDecision);
    }
}
