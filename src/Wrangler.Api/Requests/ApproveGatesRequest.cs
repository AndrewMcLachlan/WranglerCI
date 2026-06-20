namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to approve the specified deployment gates.</summary>
public record ApproveGatesRequest
{
    public IReadOnlyList<GateRef> Gates { get; init; } = [];
}

/// <summary>Identifies a single gate: one pending environment on one run.</summary>
public record GateRef
{
    public required string Owner { get; init; }
    public required string Repo { get; init; }
    public required long RunId { get; init; }
    public required long EnvironmentId { get; init; }
    public required string EnvironmentName { get; init; }
}
