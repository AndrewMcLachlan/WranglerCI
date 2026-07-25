using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers.Queries;

/// <summary>Lists pending deployment gates across the requested repositories.</summary>
public class GatesQueryHandler(IGateService service)
    : IQueryHandler<GatesRequest, IEnumerable<DeploymentGateModel>>
{
    public ValueTask<IEnumerable<DeploymentGateModel>> Handle(GatesRequest query, CancellationToken cancellationToken) =>
        new(service.GetGatesAsync(query, cancellationToken));
}
