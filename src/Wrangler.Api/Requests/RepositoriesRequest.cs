using Octokit;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to list all repositories accessible to the current user.</summary>
public record RepositoriesRequest : IQuery<IEnumerable<Repository>>;
