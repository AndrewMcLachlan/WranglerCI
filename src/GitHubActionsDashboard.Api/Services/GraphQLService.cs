#pragma warning disable CS9113
using GitHubActionsDashboard.Api.Models;
using GitHubActionsDashboard.Api.Models.Dashboard;
using Octokit.GraphQL;

namespace GitHubActionsDashboard.Api.Services;

/// <summary>
/// Provides workflow data via the GitHub GraphQL API.
/// </summary>
public interface IGraphQLService
{
    /// <summary>
    /// Retrieves workflow runs for the specified workflow node IDs.
    /// </summary>
    /// <param name="workflowNodeIds">The GraphQL node IDs of the workflows to query.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The workflows with their runs.</returns>
    Task<IEnumerable<WorkflowModel>> GetWorkflowRuns(IEnumerable<string> workflowNodeIds, CancellationToken cancellationToken = default);
}

/// <summary>
/// Retrieves workflow data using the GitHub GraphQL API.
/// </summary>
public class GraphQLService(Octokit.GraphQL.Connection connection) : IGraphQLService
{
    /// <inheritdoc />
    public Task<IEnumerable<WorkflowModel>> GetWorkflowRuns(IEnumerable<string> workflowNodeIds, CancellationToken cancellationToken = default)
    {
        throw new NotImplementedException();

        /*const int PageSize = 20;
        int pageNumber = 0;

        Arg<int> per = 20;

        List<ID> ids = [.. workflowNodeIds.Take(PageSize).Select(id => new ID(id))];

        List<WorkflowWithRuns> results = [];

        while (ids.Count > 0)
        {
            ICompiledQuery<IEnumerable<string>> MakeProbe(List<ID> ids) =>
              new Query()
                .Nodes(ids)
                .OfType<Workflow>()
                .Select(w => w.Id.Value)   // minimal shape → fewer error paths
                .Compile();

            var accessible = await FetchSafe(connection, MakeProbe, ids);

            // nodes(ids:[ID!]!) { ... on Workflow { runs(first: $per) { nodes { ... } } } }
            var query =
            new Query()
            .Nodes(accessible.ToList())
            .OfType<Octokit.GraphQL.Model.Workflow>()
            .Select(wf => new WorkflowModel
            {
                Id = wf.Id.,
                Name = wf.Name,
                Runs = wf.Runs(per, null, null, null, new Octokit.GraphQL.Model.WorkflowRunOrder
                {
                    Field = Octokit.GraphQL.Model.WorkflowRunOrderField.CreatedAt,
                    Direction = Octokit.GraphQL.Model.OrderDirection.Desc
                }).Nodes.Select(r => new WorkflowRunModel
                {
                    //DatabaseId = r.DatabaseId,
                    RunNumber = r.RunNumber,
                    //Status = r.CheckSuite.Select(c => c.Status).SingleOrDefault(),
                    //Conclusion = r.CheckSuite.Select(c => c.Conclusion).SingleOrDefault(),
                    //HeadBranch = r.CheckSuite.Select(c => c.Branch.Name).SingleOrDefault(),
                    CreatedAt = r.CreatedAt,
                    UpdatedAt = r.UpdatedAt,
                    HtmlUrl = r.Url
                }).ToList()
            })
            .Compile();

            try
            {
                results.AddRange(await connection.Run(query, cancellationToken: cancellationToken));
            }
            catch (Exception ex)
            {
                // Add logger
            }

            pageNumber++;
            ids = [.. workflowNodeIds.Skip(pageNumber * PageSize).Take(PageSize).Select(id => new ID(id))];
        }

        return results;*/
    }

    private async Task<IEnumerable<ID>> FetchSafe(
    Connection conn,
    Func<List<ID>, ICompiledQuery<IEnumerable<string>>> mkProbe,
    List<ID> ids,
    CancellationToken ct = default)
    {
        try
        {
            // If this succeeds, all ids are good
            await conn.Run(mkProbe(ids), cancellationToken: ct);
            return ids;
        }
        catch
        {
            if (ids.Count() == 1) return []; // drop bad one
            int mid = ids.Count() / 2;
            var left = await FetchSafe(conn, mkProbe, [.. ids.Take(mid)], ct);
            var right = await FetchSafe(conn, mkProbe, [.. ids.Skip(mid)], ct);
            return [.. left, .. right];
        }
    }
}
#pragma warning restore CS9113
