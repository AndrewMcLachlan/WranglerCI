using Octokit;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Queries;

/// <summary>Request to list all repositories accessible to the current user.</summary>
public record Repositories : IQuery<IEnumerable<Repository>>;

internal class RepositoriesHandler(IGitHubClient client) : IQueryHandler<Repositories, IEnumerable<Repository>>
{
    public async ValueTask<IEnumerable<Repository>> Handle(Repositories query, CancellationToken cancellationToken)
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
