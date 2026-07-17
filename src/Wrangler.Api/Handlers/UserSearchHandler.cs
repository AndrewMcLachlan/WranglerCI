using Asm.Wrangler.Api.Models.Users;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Handles GitHub user search for the pull-request author typeahead.
/// </summary>
public static class UserSearchHandler
{
    /// <summary>
    /// Searches GitHub users matching the query string <paramref name="q"/>.
    /// </summary>
    public static async Task<Ok<IEnumerable<UserSearchResult>>> Handle(
        [FromServices] IUserSearchService service,
        [FromQuery] string q,
        CancellationToken cancellationToken)
    {
        var results = await service.SearchUsersAsync(q ?? string.Empty, cancellationToken);
        return TypedResults.Ok(results);
    }
}
