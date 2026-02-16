using GitHubActionsDashboard.Api.Models.PullRequests;
using GitHubActionsDashboard.Api.Requests;
using GitHubActionsDashboard.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GitHubActionsDashboard.Api.Handlers;

/// <summary>
/// Handles requests to approve and merge pull requests.
/// </summary>
public static class ApprovePullRequestsHandler
{
    /// <summary>
    /// Approves and merges the specified pull requests.
    /// </summary>
    public static Task<IEnumerable<ApprovalResult>> Handle([FromServices] IPullRequestService service, [FromBody] ApprovePullRequestsRequest request, CancellationToken cancellationToken) => service.ApprovePullRequestsAsync(request, cancellationToken);
}
