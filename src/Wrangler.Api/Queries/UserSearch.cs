using Asm.Wrangler.Api.Models.Users;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Queries;

/// <summary>Request to search GitHub users for the pull-request author typeahead.</summary>
public record UserSearch([FromQuery(Name = "q")] string Q) : IQuery<IEnumerable<UserSearchResult>>;

internal class UserSearchHandler(IUserSearchService service) : IQueryHandler<UserSearch, IEnumerable<UserSearchResult>>
{
    public ValueTask<IEnumerable<UserSearchResult>> Handle(UserSearch query, CancellationToken cancellationToken) =>
        new(service.SearchUsersAsync(query.Q ?? String.Empty, cancellationToken));
}
