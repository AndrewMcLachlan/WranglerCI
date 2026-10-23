using System.Net;
using Asm.Wrangler.Api.Services;
using Octokit;
using Xunit;

namespace Wrangler.Tests;

public class GitHubErrorsTests
{
    [Fact]
    public void Gives_the_reason_GitHub_sends_as_a_plain_string() =>
        Assert.Equal("Can not approve your own pull request", GitHubErrors.Describe(Unprocessable("""{"message":"Unprocessable Entity","errors":["Can not approve your own pull request"]}""")));

    [Fact]
    public void Gives_the_reasons_GitHub_sends_as_objects() =>
        Assert.Equal("Review cannot be requested; Base branch was modified", GitHubErrors.Describe(Unprocessable("""{"message":"Validation Failed","errors":[{"resource":"PullRequest","code":"custom","message":"Review cannot be requested"},{"message":"Base branch was modified"}]}""")));

    [Fact]
    public void Falls_back_to_the_message_without_details() =>
        Assert.Equal("Pull Request is not mergeable", GitHubErrors.Describe(new ApiException(new FakeResponse(HttpStatusCode.MethodNotAllowed, """{"message":"Pull Request is not mergeable"}"""))));

    [Fact]
    public void Keeps_the_message_of_anything_but_a_GitHub_error() =>
        Assert.Equal("boom", GitHubErrors.Describe(new InvalidOperationException("boom")));

    private static ApiValidationException Unprocessable(string body) => new(new FakeResponse((HttpStatusCode)422, body));

    private sealed class FakeResponse(HttpStatusCode status, string body) : IResponse
    {
        public object Body => body;
        public IReadOnlyDictionary<string, string> Headers { get; } = new Dictionary<string, string>();
        public ApiInfo ApiInfo { get; } = new(new Dictionary<string, Uri>(), [], [], "", new RateLimit());
        public HttpStatusCode StatusCode => status;
        public string ContentType => "application/json";
    }
}
