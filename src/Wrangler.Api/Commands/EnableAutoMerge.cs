using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Commands;

namespace Asm.Wrangler.Api.Commands;

/// <summary>
/// Request to enable auto-merge on a batch of pull requests.
/// </summary>
public record EnableAutoMerge : ICommand<IEnumerable<ApprovalResult>>
{
    /// <summary>
    /// The pull requests to enable auto-merge on.
    /// </summary>
    public IReadOnlyList<ApprovePullRequests.PullRequestReference> PullRequests { get; init; } = [];
}

internal class EnableAutoMergeHandler(IPullRequestService service) : ICommandHandler<EnableAutoMerge, IEnumerable<ApprovalResult>>
{
    public ValueTask<IEnumerable<ApprovalResult>> Handle(EnableAutoMerge command, CancellationToken cancellationToken) =>
        new(service.EnableAutoMergeAsync(command, cancellationToken));
}
