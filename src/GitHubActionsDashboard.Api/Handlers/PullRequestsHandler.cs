using GitHubActionsDashboard.Api.Models.PullRequests;
using GitHubActionsDashboard.Api.Requests;
using GitHubActionsDashboard.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GitHubActionsDashboard.Api.Handlers;

/// <summary>
/// Handles requests to retrieve open pull requests.
/// </summary>
public static class PullRequestsHandler
{
    /// <summary>
    /// Retrieves open pull requests matching the specified repositories and author filters.
    /// </summary>
    public static Task<IEnumerable<PullRequestModel>> Handle([FromServices] IPullRequestService service, [FromBody] PullRequestsRequest request, CancellationToken cancellationToken) => service.GetPullRequestsAsync(request, cancellationToken);
}
