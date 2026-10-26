using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Queries;

/// <summary>
/// Request to retrieve open pull requests from the specified repositories, filtered by author.
/// </summary>
public record PullRequests : IQuery<IEnumerable<PullRequestModel>>
{
    /// <summary>
    /// A repository identified by owner and name.
    /// </summary>
    public record RepositoryRequest
    {
        /// <summary>
        /// The repository owner (user or organisation login).
        /// </summary>
        public required string Owner { get; init; }

        /// <summary>
        /// The repository name.
        /// </summary>
        public required string Name { get; init; }
    }

    /// <summary>
    /// The repositories to search for open pull requests.
    /// </summary>
    public IReadOnlyList<RepositoryRequest> Repositories { get; init; } = [];

    /// <summary>
    /// The author logins to filter by (case-insensitive).
    /// </summary>
    public IReadOnlyList<string> Authors { get; init; } = [];

    /// <summary>
    /// When true, <see cref="Authors"/> is ignored and the result is the signed-in user's pull requests:
    /// those assigned to them, and those they opened that nobody is assigned to.
    /// </summary>
    public bool Mine { get; init; }
}

internal class PullRequestsHandler(IPullRequestService service) : IQueryHandler<PullRequests, IEnumerable<PullRequestModel>>
{
    public ValueTask<IEnumerable<PullRequestModel>> Handle(PullRequests query, CancellationToken cancellationToken) =>
        new(service.GetPullRequestsAsync(query, cancellationToken));
}
