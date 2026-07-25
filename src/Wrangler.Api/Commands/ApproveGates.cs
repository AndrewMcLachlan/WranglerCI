using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Commands;

namespace Asm.Wrangler.Api.Commands;

/// <summary>Request to approve the specified deployment gates.</summary>
public record ApproveGates : ICommand<IEnumerable<GateApprovalResult>>
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

internal class ApproveGatesHandler(IGateService service) : ICommandHandler<ApproveGates, IEnumerable<GateApprovalResult>>
{
    public ValueTask<IEnumerable<GateApprovalResult>> Handle(ApproveGates command, CancellationToken cancellationToken) =>
        new(service.ApproveGatesAsync(command, cancellationToken));
}
