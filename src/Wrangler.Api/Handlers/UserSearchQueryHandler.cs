using Asm.Wrangler.Api.Models.Users;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Searches GitHub users matching the query string.</summary>
public class UserSearchQueryHandler(IUserSearchService service)
    : IQueryHandler<UserSearchRequest, IEnumerable<UserSearchResult>>
{
    public ValueTask<IEnumerable<UserSearchResult>> Handle(UserSearchRequest query, CancellationToken cancellationToken) =>
        new(service.SearchUsersAsync(query.Q ?? String.Empty, cancellationToken));
}
