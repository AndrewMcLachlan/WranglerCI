namespace Asm.Wrangler.Api.Models.Gates;

/// <summary>The outcome of approving a single deployment gate.</summary>
public record GateApprovalResult
{
    public required string RepositoryOwner { get; init; }
    public required string RepositoryName { get; init; }
    public required long WorkflowRunId { get; init; }
    public required string EnvironmentName { get; init; }
    public required bool Approved { get; init; }
    public string? Error { get; init; }
}
