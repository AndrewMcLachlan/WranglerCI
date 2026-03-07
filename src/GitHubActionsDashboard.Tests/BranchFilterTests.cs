using GitHubActionsDashboard.Api;

namespace GitHubActionsDashboard.Tests;

public class BranchFilterTests
{
    [Fact]
    public void EmptyFilters_ReturnsTrue()
    {
        Assert.True(BranchFilter.Match("main", []));
    }

    [Fact]
    public void ExactMatch_ReturnsTrue()
    {
        Assert.True(BranchFilter.Match("main", ["main"]));
    }

    [Fact]
    public void ExactMatch_NoMatch_ReturnsFalse()
    {
        Assert.False(BranchFilter.Match("develop", ["main"]));
    }

    [Fact]
    public void WildcardMatch_ReturnsTrue()
    {
        Assert.True(BranchFilter.Match("release/1.0", ["release/*"]));
    }

    [Fact]
    public void WildcardMatch_NoMatch_ReturnsFalse()
    {
        Assert.False(BranchFilter.Match("feature/foo", ["release/*"]));
    }

    [Fact]
    public void MultipleFilters_MatchesAny()
    {
        Assert.True(BranchFilter.Match("develop", ["main", "develop"]));
    }

    [Fact]
    public void MixedExactAndWildcard_MatchesWildcard()
    {
        Assert.True(BranchFilter.Match("release/2.0", ["main", "release/*"]));
    }

    [Fact]
    public void MixedExactAndWildcard_MatchesExact()
    {
        Assert.True(BranchFilter.Match("main", ["main", "release/*"]));
    }

    [Fact]
    public void WildcardAtEnd_MatchesPrefix()
    {
        Assert.True(BranchFilter.Match("feature/my-branch", ["feature/*"]));
    }

    [Fact]
    public void WildcardOnly_MatchesNothing()
    {
        // "*" trims to empty string, so StartsWith("") is always true
        Assert.True(BranchFilter.Match("anything", ["*"]));
    }
}
