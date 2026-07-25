using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Commands;

namespace Asm.Wrangler.Api.Handlers.Commands;

/// <summary>Approves and merges the specified pull requests.</summary>
public class ApprovePullRequestsCommandHandler(IPullRequestService service)
    : ICommandHandler<ApprovePullRequestsRequest, IEnumerable<ApprovalResult>>
{
    public ValueTask<IEnumerable<ApprovalResult>> Handle(ApprovePullRequestsRequest command, CancellationToken cancellationToken) =>
        new(service.ApprovePullRequestsAsync(command, cancellationToken));
}
