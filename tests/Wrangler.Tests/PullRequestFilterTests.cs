using Asm.Wrangler.Api.Services;
using Xunit;

namespace Wrangler.Tests;

public class PullRequestFilterTests
{
    private static readonly PullRequestFilter mine = PullRequestFilter.Mine("Andrew");

    [Fact]
    public void Mine_includes_your_own_unassigned_pull_request() =>
        Assert.True(mine.Matches("andrew", []));

    [Fact]
    public void Mine_excludes_your_own_pull_request_assigned_to_someone_else() =>
        Assert.False(mine.Matches("andrew", ["octocat"]));

    [Fact]
    public void Mine_includes_your_own_pull_request_assigned_to_you() =>
        Assert.True(mine.Matches("andrew", ["octocat", "ANDREW"]));

    [Fact]
    public void Mine_includes_someone_elses_pull_request_assigned_to_you() =>
        Assert.True(mine.Matches("dependabot[bot]", ["andrew"]));

    [Fact]
    public void Mine_excludes_someone_elses_unassigned_pull_request() =>
        Assert.False(mine.Matches("octocat", []));

    [Theory]
    [InlineData("Dependabot[bot]", true)]
    [InlineData("octocat", false)]
    public void ByAuthors_matches_author_case_insensitively_and_ignores_assignees(string author, bool expected) =>
        Assert.Equal(expected, PullRequestFilter.ByAuthors(["dependabot[bot]", "renovate[bot]"]).Matches(author, ["andrew"]));
}
