namespace Asm.Wrangler.Api.Models;

/// <summary>
/// A minimal, sanitized notification of a webhook delivery, suitable
/// for broadcast to connected SSE clients. The payload tells the client
/// what to invalidate, not what changed.
/// </summary>
public record GitHubEvent
{
    public required string Type { get; init; }
    public required string Owner { get; init; }
    public required string Repo { get; init; }
    public long? WorkflowId { get; init; }
    public long? RunId { get; init; }
    public int? PullRequestNumber { get; init; }
    public string? DeliveryId { get; init; }
}
