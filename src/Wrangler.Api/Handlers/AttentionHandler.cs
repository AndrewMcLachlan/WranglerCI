using Asm.Wrangler.Api.Models.Attention;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Returns the unified attention feed across the requested repositories.
/// </summary>
public static class AttentionHandler
{
    public static Task<IEnumerable<AttentionItem>> Handle(
        [FromServices] IAttentionService service,
        [FromBody] AttentionRequest request,
        CancellationToken cancellationToken) =>
        service.GetAttentionItemsAsync(request, cancellationToken);
}
