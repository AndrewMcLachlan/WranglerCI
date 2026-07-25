using Asm.Wrangler.Api.Requests;
using Octokit;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers.Queries;

/// <summary>Retrieves all repositories from the user's organisations and personal account.</summary>
public class RepositoriesQueryHandler(IGitHubClient client)
    : IQueryHandler<RepositoriesRequest, IEnumerable<Repository>>
{
    public async ValueTask<IEnumerable<Repository>> Handle(RepositoriesRequest query, CancellationToken cancellationToken)
    {
        List<Repository> repositories = [];

        var orgs = await client.Organization.GetAllForCurrent();

        foreach (var org in orgs)
        {
            repositories.AddRange(await client.Repository.GetAllForOrg(org.Name));
        }

        repositories.AddRange(await client.Repository.GetAllForCurrent());

        return repositories;
    }
}
