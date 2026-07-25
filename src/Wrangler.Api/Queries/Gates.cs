using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Queries;

/// <summary>Request to list pending deployment gates across repositories.</summary>
public record Gates : IQuery<IEnumerable<DeploymentGateModel>>
{
    /// <summary>A repository identified by owner and name.</summary>
    public record RepositoryRequest
    {
        public required string Owner { get; init; }
        public required string Name { get; init; }
    }

    /// <summary>The repositories to scan for waiting runs.</summary>
    public IReadOnlyList<RepositoryRequest> Repositories { get; init; } = [];
}

internal class GatesHandler(IGateService service) : IQueryHandler<Gates, IEnumerable<DeploymentGateModel>>
{
    public ValueTask<IEnumerable<DeploymentGateModel>> Handle(Gates query, CancellationToken cancellationToken) =>
        new(service.GetGatesAsync(query, cancellationToken));
}
