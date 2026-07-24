using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Retrieves open pull requests matching the specified repositories and author filters.</summary>
public class PullRequestsQueryHandler(IPullRequestService service)
    : IQueryHandler<PullRequestsRequest, IEnumerable<PullRequestModel>>
{
    public ValueTask<IEnumerable<PullRequestModel>> Handle(PullRequestsRequest query, CancellationToken cancellationToken) =>
        new(service.GetPullRequestsAsync(query, cancellationToken));
}
