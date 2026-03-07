using Octokit;

namespace Asm.Wrangler.Api.Models.Dashboard;

/// <summary>
/// Represents a repository with its workflows and aggregated RAG status.
/// </summary>
public record RepositoryModel : Models.RepositoryBase
{
    /// <summary>
    /// The overall RAG status computed from the most recent run of each workflow branch.
    /// </summary>
    public WorkflowStatus OverallStatus
    {
        get
        {
            var statuses = Workflows.SelectMany(w => w.Runs.GroupBy(r => r.HeadBranch).Select(rg => rg.OrderByDescending(r => r.UpdatedAt).First())).Select(r => r.WorkflowStatus);

            if (statuses.Contains(WorkflowStatus.Red)) return WorkflowStatus.Red;
            if (statuses.Contains(WorkflowStatus.Amber)) return WorkflowStatus.Amber;
            if (statuses.Contains(WorkflowStatus.Waiting)) return WorkflowStatus.Waiting;
            if (statuses.Contains(WorkflowStatus.Running)) return WorkflowStatus.Running;
            if (statuses.Contains(WorkflowStatus.Green)) return WorkflowStatus.Green;

            return WorkflowStatus.None;
        }
    }

    /// <summary>
    /// The workflows belonging to this repository.
    /// </summary>
    public IEnumerable<WorkflowModel> Workflows { get; init; } = [];
}
