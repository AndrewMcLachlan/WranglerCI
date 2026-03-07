using Octokit;

namespace Asm.Wrangler.Api.Models.Dashboard;

/// <summary>
/// Represents a single workflow run with its conclusion and RAG status.
/// </summary>
public record WorkflowRunModel
{
    /// <summary>
    /// The GitHub database ID of the workflow run.
    /// </summary>
    public required long Id { get; init; }

    /// <summary>
    /// The ID of the workflow this run belongs to.
    /// </summary>
    public required long WorkflowId { get; init; }

    /// <summary>
    /// The GraphQL node ID.
    /// </summary>
    public required string NodeId { get; init; }

    /// <summary>
    /// The conclusion of the workflow run, if completed.
    /// </summary>
    public required StringEnum<WorkflowRunConclusion>? Conclusion { get; init; }

    /// <summary>
    /// The name of the head branch.
    /// </summary>
    public required string HeadBranch { get; init; }

    /// <summary>
    /// The event that triggered the workflow run.
    /// </summary>
    public required string Event { get; init; }

    /// <summary>
    /// The sequential run number for the workflow.
    /// </summary>
    public required long RunNumber { get; init; }

    /// <summary>
    /// The name or login of the actor that triggered the run.
    /// </summary>
    public string? TriggeringActor { get; init; }

    /// <summary>
    /// The current status of the workflow run.
    /// </summary>
    public required StringEnum<WorkflowRunStatus> Status { get; init; }

    /// <summary>
    /// When the workflow run was created.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>
    /// When the workflow run was last updated.
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; init; }

    /// <summary>
    /// The URL to view the workflow run on GitHub.
    /// </summary>
    public required string HtmlUrl { get; init; }

    /// <summary>
    /// The computed RAG status derived from the workflow run conclusion.
    /// </summary>
    public RagStatus RagStatus
    {
        get
        {
            if (Conclusion == WorkflowRunConclusion.Failure ||
                Conclusion == WorkflowRunConclusion.StartupFailure ||
                Conclusion == WorkflowRunConclusion.TimedOut)
            {
                return RagStatus.Red;
            }

            if (Conclusion == WorkflowRunConclusion.ActionRequired ||
                Conclusion == WorkflowRunConclusion.Cancelled ||
                Conclusion == WorkflowRunConclusion.Skipped)
            {
                return RagStatus.Amber;
            }

            if (Conclusion == WorkflowRunConclusion.Success)
            {
                return RagStatus.Green;
            }

            return RagStatus.None;
        }
    }
}

