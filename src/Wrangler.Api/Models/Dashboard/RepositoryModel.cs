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
    public RagStatus OverallStatus
    {
        get
        {
            var conclusions = Workflows.SelectMany(w => w.Runs.GroupBy(r => r.HeadBranch).Select(rg => rg.OrderByDescending(r => r.UpdatedAt).First())).Select(r => r.Conclusion);

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

    /// <summary>
    /// The workflows belonging to this repository.
    /// </summary>
    public IEnumerable<WorkflowModel> Workflows { get; init; } = [];
}
