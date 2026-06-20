namespace Asm.Wrangler.Api.Models.Gates;

/// <summary>
/// A workflow run paused at an environment protection rule (a "gate"),
/// surfaced once per pending environment.
/// </summary>
public record DeploymentGateModel
{
    public required string RepositoryOwner { get; init; }
    public required string RepositoryName { get; init; }
    public required long WorkflowRunId { get; init; }
    public required long RunNumber { get; init; }
    public required string WorkflowName { get; init; }
    public required string HeadBranch { get; init; }
    public required string Event { get; init; }
    public required string HtmlUrl { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required DateTimeOffset UpdatedAt { get; init; }
    public required long EnvironmentId { get; init; }
    public required string EnvironmentName { get; init; }

    /// <summary>Whether the current user is eligible to approve this gate.</summary>
    public required bool CurrentUserCanApprove { get; init; }
}
