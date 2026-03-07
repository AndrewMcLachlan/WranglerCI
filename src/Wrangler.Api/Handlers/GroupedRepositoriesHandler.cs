using Asm.Wrangler.Api.Models.Settings;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Handles requests to list all repositories grouped by account, including their workflows.
/// </summary>
public static class GroupedRepositoriesHandler
{
    /// <summary>
    /// Retrieves all accessible repositories grouped by owner, with their available workflows.
    /// </summary>
    public static Task<IEnumerable<AccountModel>> Handle([FromServices] ISettingsService settingsService, CancellationToken cancellationToken) =>
        settingsService.ListAllWorkflowsAsync(cancellationToken);
}
