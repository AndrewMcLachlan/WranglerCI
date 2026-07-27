using Asm.Wrangler.Api.Endpoints;
using Xunit;

namespace Wrangler.Tests;

public class ReturnUrlTests
{
    [Theory]
    [InlineData("/pull-requests")]
    [InlineData("/gates?author=octocat")]
    [InlineData("/attention")]
    [InlineData("/settings/repositories")]
    public void ResolveOrFallback_keeps_safe_local_paths(string url)
    {
        Assert.Equal(url, ReturnUrl.ResolveOrFallback(url));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("pull-requests")]              // not rooted
    [InlineData("//evil.com")]                 // protocol-relative
    [InlineData("/\\evil.com")]                // backslash trick
    [InlineData("https://evil.com")]           // absolute URL
    [InlineData("http://evil.com/path")]       // absolute URL
    [InlineData("/login/github")]              // auth surface (loop guard)
    [InlineData("/callback/github")]           // auth surface (loop guard)
    [InlineData("/api/workflows")]             // api surface (loop guard)
    public void ResolveOrFallback_falls_back_to_dashboard_for_unsafe_or_missing(string? url)
    {
        Assert.Equal("/dashboard", ReturnUrl.ResolveOrFallback(url));
    }
}
