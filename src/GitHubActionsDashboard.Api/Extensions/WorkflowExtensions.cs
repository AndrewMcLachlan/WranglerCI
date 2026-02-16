
namespace GitHubActionsDashboard.Api.Models;

/// <summary>
/// Extension methods for converting Octokit workflow types to application models.
/// </summary>
public static class WorkflowExtensions
{
    /// <summary>
    /// Converts Octokit workflows to <see cref="Dashboard.WorkflowModel"/> instances.
    /// </summary>
    public static IEnumerable<Dashboard.WorkflowModel> ToDashboardWorkflowModel(this IEnumerable<Octokit.Workflow> workflows)
    {
        foreach (var workflow in workflows)
        {
            yield return new Dashboard.WorkflowModel
            {
                Name = workflow.Name,
                Id = workflow.Id,
                NodeId = workflow.NodeId,
                HtmlUrl = workflow.HtmlUrl,
            };
        }
    }

    /// <summary>
    /// Converts Octokit workflows to <see cref="WorkflowBase"/> instances.
    /// </summary>
    public static IEnumerable<WorkflowBase> ToWorkflowBase(this IEnumerable<Octokit.Workflow> workflows)
    {
        foreach (var workflow in workflows)
        {
            yield return new WorkflowBase
            {
                Name = workflow.Name,
                Id = workflow.Id,
                NodeId = workflow.NodeId,
                HtmlUrl = workflow.HtmlUrl,
            };
        }
    }
}
