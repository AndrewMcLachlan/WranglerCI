using Asm.Wrangler.Api.Models.Settings;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers.Queries;

/// <summary>Retrieves all accessible repositories grouped by owner, with their available workflows.</summary>
public class GroupedRepositoriesQueryHandler(ISettingsService settingsService)
    : IQueryHandler<GroupedRepositoriesRequest, IEnumerable<AccountModel>>
{
    public ValueTask<IEnumerable<AccountModel>> Handle(GroupedRepositoriesRequest query, CancellationToken cancellationToken) =>
        new(settingsService.ListAllWorkflowsAsync(cancellationToken));
}
