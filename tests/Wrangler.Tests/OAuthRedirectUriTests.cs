using Asm.Wrangler.Api.Endpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Wrangler.Tests;

public class OAuthRedirectUriTests
{
    private static readonly IConfiguration configuration = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["RedirectUri"] = "https://wrangler.example/callback/github",
            ["RedirectUris:0"] = "https://localhost:3010/callback/github",
            ["RedirectUris:1"] = "https://wranglerci.dev.localhost:3010/callback/github",
            ["RedirectUris:2"] = "https://ra.mclachlan.family:3010/callback/github",
        })
        .Build();

    [Theory]
    [InlineData("localhost:3010", "https://localhost:3010/callback/github")]
    [InlineData("wranglerci.dev.localhost:3010", "https://wranglerci.dev.localhost:3010/callback/github")]
    [InlineData("RA.McLachlan.Family:3010", "https://ra.mclachlan.family:3010/callback/github")]
    public void Resolve_uses_the_configured_uri_for_the_request_host(string host, string expected)
    {
        Assert.Equal(expected, OAuthRedirectUri.Resolve(configuration, new HostString(host)));
    }

    [Theory]
    [InlineData("evil.example")]
    [InlineData("localhost:5010")]
    [InlineData("ra.mclachlan.family")]
    public void Resolve_falls_back_to_the_default_for_any_other_host(string host)
    {
        Assert.Equal("https://wrangler.example/callback/github", OAuthRedirectUri.Resolve(configuration, new HostString(host)));
    }

    [Fact]
    public void Resolve_uses_the_default_when_no_list_is_configured()
    {
        var single = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RedirectUri"] = "https://wrangler.example/callback/github" }).Build();

        Assert.Equal("https://wrangler.example/callback/github", OAuthRedirectUri.Resolve(single, new HostString("localhost:3010")));
    }
}
