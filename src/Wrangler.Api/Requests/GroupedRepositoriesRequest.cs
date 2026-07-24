using Asm.Wrangler.Api.Models.Settings;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to list all repositories grouped by owner, with their workflows.</summary>
public record GroupedRepositoriesRequest : IQuery<IEnumerable<AccountModel>>;
