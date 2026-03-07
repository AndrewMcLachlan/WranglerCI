using Asm.Wrangler.Api.Handlers;

namespace Asm.Wrangler.Tests;

public class ParseFormEncodedStringTests
{
    [Fact]
    public void ParsesAccessToken()
    {
        var result = CallbackHandler.ParseFormEncodedString("access_token=gho_abc123&token_type=bearer&scope=read%3Auser+repo");

        Assert.Equal("gho_abc123", result["access_token"]);
        Assert.Equal("bearer", result["token_type"]);
        Assert.Equal("read:user repo", result["scope"]);
    }

    [Fact]
    public void EmptyString_ReturnsEmptyDictionary()
    {
        var result = CallbackHandler.ParseFormEncodedString("");
        Assert.Empty(result);
    }

    [Fact]
    public void NullString_ReturnsEmptyDictionary()
    {
        var result = CallbackHandler.ParseFormEncodedString(null!);
        Assert.Empty(result);
    }

    [Fact]
    public void MalformedPair_Skipped()
    {
        var result = CallbackHandler.ParseFormEncodedString("access_token=abc&malformed&other=value");

        Assert.Equal("abc", result["access_token"]);
        Assert.Equal("value", result["other"]);
        Assert.False(result.ContainsKey("malformed"));
    }

    [Fact]
    public void ValueContainsEquals_PreservedCorrectly()
    {
        var result = CallbackHandler.ParseFormEncodedString("key=value=with=equals");

        Assert.Equal("value=with=equals", result["key"]);
    }

    [Fact]
    public void UrlEncodedValues_Decoded()
    {
        var result = CallbackHandler.ParseFormEncodedString("scope=read%3Auser%20repo");

        Assert.Equal("read:user repo", result["scope"]);
    }

    [Fact]
    public void ErrorResponse_Parsed()
    {
        var result = CallbackHandler.ParseFormEncodedString("error=bad_verification_code&error_description=The+code+passed+is+incorrect+or+expired.");

        Assert.Equal("bad_verification_code", result["error"]);
        Assert.Equal("The code passed is incorrect or expired.", result["error_description"]);
    }
}
