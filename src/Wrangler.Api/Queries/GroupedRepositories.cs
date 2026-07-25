using Asm.Wrangler.Api.Models.Settings;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Queries;

/// <summary>Request to list all repositories grouped by owner, with their workflows.</summary>
public record GroupedRepositories : IQuery<IEnumerable<AccountModel>>;

internal class GroupedRepositoriesHandler(ISettingsService settingsService) : IQueryHandler<GroupedRepositories, IEnumerable<AccountModel>>
{
    public ValueTask<IEnumerable<AccountModel>> Handle(GroupedRepositories query, CancellationToken cancellationToken) =>
        new(settingsService.ListAllWorkflowsAsync(cancellationToken));
}
