using Octokit;

namespace Asm.Wrangler.Api.Models.Dashboard;

/// <summary>
/// Represents a workflow with its runs and aggregated RAG status.
/// </summary>
public record WorkflowModel : Models.WorkflowBase
{
    /// <summary>
    /// The workflow runs for this workflow.
    /// </summary>
    public IList<WorkflowRunModel> Runs { get; init; } = [];

    /// <summary>
    /// The RAG status of the latest run.
    /// </summary>
    public WorkflowStatus RunStatus { get; init; }

    /// <summary>
    /// The overall RAG status computed from the most recent run of each branch.
    /// </summary>
    public WorkflowStatus OverallStatus
    {
        get
        {
            var statuses = Runs.GroupBy(r => r.HeadBranch).Select(rg => rg.OrderByDescending(r => r.UpdatedAt).First()).Select(r => r.WorkflowStatus);

            if (statuses.Contains(WorkflowStatus.Red)) return WorkflowStatus.Red;
            if (statuses.Contains(WorkflowStatus.Amber)) return WorkflowStatus.Amber;
            if (statuses.Contains(WorkflowStatus.Waiting)) return WorkflowStatus.Waiting;
            if (statuses.Contains(WorkflowStatus.Running)) return WorkflowStatus.Running;
            if (statuses.Contains(WorkflowStatus.Green)) return WorkflowStatus.Green;

            return WorkflowStatus.None;
        }
    }
}
