using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Octokit;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Handles requests to list all repositories accessible to the current user.
/// </summary>
public static class RepositoriesHandler
{
    /// <summary>
    /// Retrieves all repositories from the user's organisations and personal account.
    /// </summary>
    public static async Task<Ok<IEnumerable<Repository>>> Handle([FromServices]IGitHubClient client)
    {
        List<Repository> repositories = [];

        var orgs = await client.Organization.GetAllForCurrent();

        foreach (var org in orgs)
        {
            repositories.AddRange(await client.Repository.GetAllForOrg(org.Name));
        }

        repositories.AddRange(await client.Repository.GetAllForCurrent());

        return TypedResults.Ok(repositories.AsEnumerable());
    }
}
