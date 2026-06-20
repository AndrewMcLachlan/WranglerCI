using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Lists pending deployment gates across the requested repositories.</summary>
public static class GatesHandler
{
    public static Task<IEnumerable<DeploymentGateModel>> Handle(
        [FromServices] IGateService service,
        [FromBody] GatesRequest request,
        CancellationToken cancellationToken) =>
        service.GetGatesAsync(request, cancellationToken);
}
