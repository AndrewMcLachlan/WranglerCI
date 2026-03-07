namespace Asm.Wrangler.Api.Requests;

/// <summary>
/// Request to retrieve workflow runs, optionally filtered by branch.
/// </summary>
public record WorkflowRunsRequest : BranchFilterRequest
{
}
