using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Approves the specified deployment gates.</summary>
public static class ApproveGatesHandler
{
    public static Task<IEnumerable<GateApprovalResult>> Handle(
        [FromServices] IGateService service,
        [FromBody] ApproveGatesRequest request,
        CancellationToken cancellationToken) =>
        service.ApproveGatesAsync(request, cancellationToken);
}
