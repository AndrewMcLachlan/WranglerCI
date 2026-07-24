using Asm.Wrangler.Api.Models.Attention;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Returns the unified attention feed across the requested repositories.</summary>
public class AttentionQueryHandler(IAttentionService service)
    : IQueryHandler<AttentionRequest, IEnumerable<AttentionItem>>
{
    public ValueTask<IEnumerable<AttentionItem>> Handle(AttentionRequest query, CancellationToken cancellationToken) =>
        new(service.GetAttentionItemsAsync(query, cancellationToken));
}
