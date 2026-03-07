using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

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
