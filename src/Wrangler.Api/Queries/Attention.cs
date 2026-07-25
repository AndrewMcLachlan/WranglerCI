using Asm.Wrangler.Api.Models.Attention;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Queries;

/// <summary>
/// Request to retrieve the unified attention feed for the specified repositories.
/// </summary>
public record Attention : IQuery<IEnumerable<AttentionItem>>
{
    /// <summary>A repository identified by owner and name.</summary>
    public record RepositoryRequest
    {
        public required string Owner { get; init; }
        public required string Name { get; init; }
    }

    /// <summary>The repositories to scan for items needing attention.</summary>
    public IReadOnlyList<RepositoryRequest> Repositories { get; init; } = [];
}

internal class AttentionHandler(IAttentionService service) : IQueryHandler<Attention, IEnumerable<AttentionItem>>
{
    public ValueTask<IEnumerable<AttentionItem>> Handle(Attention query, CancellationToken cancellationToken) =>
        new(service.GetAttentionItemsAsync(query, cancellationToken));
}
