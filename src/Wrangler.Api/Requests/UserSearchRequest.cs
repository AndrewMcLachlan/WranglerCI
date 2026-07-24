using Asm.Wrangler.Api.Models.Users;
using Microsoft.AspNetCore.Mvc;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to search GitHub users for the pull-request author typeahead.</summary>
public record UserSearchRequest([FromQuery(Name = "q")] string Q) : IQuery<IEnumerable<UserSearchResult>>;
