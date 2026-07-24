using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Commands;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Approves the specified deployment gates.</summary>
public class ApproveGatesCommandHandler(IGateService service)
    : ICommandHandler<ApproveGatesRequest, IEnumerable<GateApprovalResult>>
{
    public ValueTask<IEnumerable<GateApprovalResult>> Handle(ApproveGatesRequest command, CancellationToken cancellationToken) =>
        new(service.ApproveGatesAsync(command, cancellationToken));
}
