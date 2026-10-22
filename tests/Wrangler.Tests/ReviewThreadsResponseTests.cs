using Asm.Wrangler.Api.GraphQL;
using Octokit.Internal;
using Xunit;

namespace Wrangler.Tests;

/// <summary>
/// The response goes through Octokit's own serializer, which binds only snake_case, so the query
/// aliases every multi-word field.
/// </summary>
public class ReviewThreadsResponseTests
{
    [Fact]
    public void Counts_unresolved_threads_per_pull_request()
    {
        const string json = """
            {"data":{"repository":{"pull_requests":{"nodes":[
              {"number":12,"review_threads":{"nodes":[{"is_resolved":false},{"is_resolved":true},{"is_resolved":false}]}},
              {"number":13,"review_threads":{"nodes":[{"is_resolved":true}]}},
              {"number":14,"review_threads":{"nodes":[]}}
            ]}}}}
            """;

        var response = new SimpleJsonSerializer().Deserialize<ReviewThreadsResponse>(json);

        Assert.Equal(new Dictionary<int, int> { [12] = 2, [13] = 0, [14] = 0 }, response.UnresolvedByNumber());
    }

    [Fact]
    public void Reports_nothing_when_GitHub_returns_errors_instead_of_data()
    {
        const string json = """{"data":null,"errors":[{"message":"Could not resolve to a Repository"}]}""";

        var response = new SimpleJsonSerializer().Deserialize<ReviewThreadsResponse>(json);

        Assert.Empty(response.UnresolvedByNumber());
    }
}
