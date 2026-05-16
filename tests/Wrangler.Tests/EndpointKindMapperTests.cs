using Asm.Wrangler.Api.Webhooks;

namespace Asm.Wrangler.Tests;

public class EndpointKindMapperTests
{
    [Theory]
    [InlineData("/repos/octocat/Hello-World/actions/workflows", "octocat", "Hello-World", RepoDataKind.Workflows)]
    [InlineData("/repos/octocat/Hello-World/actions/workflows/12345", "octocat", "Hello-World", RepoDataKind.Workflows)]
    [InlineData("/repos/octocat/Hello-World/actions/workflows/12345/runs", "octocat", "Hello-World", RepoDataKind.WorkflowRuns)]
    [InlineData("/repos/octocat/Hello-World/actions/runs", "octocat", "Hello-World", RepoDataKind.WorkflowRuns)]
    [InlineData("/repos/octocat/Hello-World/actions/runs/9999", "octocat", "Hello-World", RepoDataKind.WorkflowRuns)]
    [InlineData("/repos/octocat/Hello-World/pulls", "octocat", "Hello-World", RepoDataKind.Pulls)]
    [InlineData("/repos/octocat/Hello-World/pulls/42", "octocat", "Hello-World", RepoDataKind.Pulls)]
    [InlineData("/repos/octocat/Hello-World/check-runs", "octocat", "Hello-World", RepoDataKind.Checks)]
    [InlineData("/repos/octocat/Hello-World/check-suites", "octocat", "Hello-World", RepoDataKind.Checks)]
    [InlineData("/repos/octocat/Hello-World/commits/abc123/check-runs", "octocat", "Hello-World", RepoDataKind.Checks)]
    [InlineData("/repos/octocat/Hello-World/commits/abc123/status", "octocat", "Hello-World", RepoDataKind.Checks)]
    public void MapsKnownEndpoints(string path, string expectedOwner, string expectedRepo, RepoDataKind expectedKind)
    {
        Assert.True(EndpointKindMapper.TryMap(path, out var owner, out var repo, out var kind));
        Assert.Equal(expectedOwner, owner);
        Assert.Equal(expectedRepo, repo);
        Assert.Equal(expectedKind, kind);
    }

    [Theory]
    [InlineData("/user/repos")]
    [InlineData("/repos/octocat/Hello-World")]                          // bare repo, no tail
    [InlineData("/repos/octocat/Hello-World/contents/README.md")]       // unrelated tail
    [InlineData("/repos/octocat/Hello-World/commits/abc123")]           // commit details (not status/checks)
    [InlineData("")]
    public void DoesNotMapUnknownEndpoints(string path)
    {
        Assert.False(EndpointKindMapper.TryMap(path, out _, out _, out _));
    }

    [Fact]
    public void StripsQueryString()
    {
        Assert.True(EndpointKindMapper.TryMap("/repos/octocat/Hello-World/pulls?state=open&per_page=100", out var owner, out var repo, out var kind));
        Assert.Equal("octocat", owner);
        Assert.Equal("Hello-World", repo);
        Assert.Equal(RepoDataKind.Pulls, kind);
    }

    [Fact]
    public void IsCaseInsensitiveOnFixedSegments()
    {
        Assert.True(EndpointKindMapper.TryMap("/REPOS/octocat/Hello-World/PULLS", out _, out _, out var kind));
        Assert.Equal(RepoDataKind.Pulls, kind);
    }
}
