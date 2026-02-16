using Octokit;

namespace GitHubActionsDashboard.Api.Models.Dashboard;

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
    public RagStatus RunStatus { get; init; }

    /// <summary>
    /// The overall RAG status computed from the most recent run of each branch.
    /// </summary>
    public RagStatus OverallStatus
    {
        get
        {
            //var conclusions = Runs.Select(r => r.Details.Conclusion).Distinct();
            var conclusions = Runs.GroupBy(r => r.HeadBranch).Select(rg => rg.OrderByDescending(r => r.UpdatedAt).First()).Select(r => r.Conclusion);

            if (conclusions.Contains(WorkflowRunConclusion.Failure) ||
                conclusions.Contains(WorkflowRunConclusion.StartupFailure) ||
                conclusions.Contains(WorkflowRunConclusion.TimedOut))
            {
                return RagStatus.Red;
            }

            if (conclusions.Contains(WorkflowRunConclusion.ActionRequired) ||
                conclusions.Contains(WorkflowRunConclusion.Cancelled) ||
                conclusions.Contains(WorkflowRunConclusion.Skipped))
            {
                return RagStatus.Amber;
            }

            if (conclusions.Contains(WorkflowRunConclusion.Success))
            {
                return RagStatus.Green;
            }

            return RagStatus.None;
        }
    }
}
