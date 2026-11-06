using Asm.Wrangler.Api.Services;
using Xunit;

namespace Wrangler.Tests;

public class PullRequestFilterTests
{
    private static readonly PullRequestFilter mine = PullRequestFilter.Mine("Andrew");

    [Fact]
    public void Mine_includes_your_own_unassigned_pull_request() =>
        Assert.True(mine.Matches("andrew", false, []));

    [Fact]
    public void Mine_excludes_your_own_pull_request_assigned_to_someone_else() =>
        Assert.False(mine.Matches("andrew", false, ["octocat"]));

    [Fact]
    public void Mine_includes_your_own_pull_request_assigned_to_you() =>
        Assert.True(mine.Matches("andrew", false, ["octocat", "ANDREW"]));

    [Fact]
    public void Mine_includes_someone_elses_pull_request_assigned_to_you() =>
        Assert.True(mine.Matches("dependabot[bot]", true, ["andrew"]));

    [Fact]
    public void Mine_excludes_someone_elses_unassigned_pull_request() =>
        Assert.False(mine.Matches("octocat", false, []));

    [Theory]
    [InlineData("Dependabot[bot]", true)]
    [InlineData("octocat", false)]
    public void ByAuthors_matches_author_case_insensitively_and_ignores_assignees(string author, bool expected) =>
        Assert.Equal(expected, PullRequestFilter.ByAuthors(["dependabot[bot]", "renovate[bot]"]).Matches(author, true, ["andrew"]));

    [Fact]
    public void ByAuthors_with_no_authors_matches_everyone() =>
        Assert.True(PullRequestFilter.ByAuthors([]).Matches("octocat", false, []));

    [Theory]
    [InlineData("dependabot[bot]", true, true)]
    [InlineData("andrew", false, false)]
    public void Bots_matches_bot_authors_only(string author, bool authorIsBot, bool expected) =>
        Assert.Equal(expected, PullRequestFilter.Bots.Matches(author, authorIsBot, ["andrew"]));
}
