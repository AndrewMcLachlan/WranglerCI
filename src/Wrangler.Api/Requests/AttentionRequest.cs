namespace Asm.Wrangler.Api.Requests;

/// <summary>
/// Request to retrieve the unified attention feed for the specified repositories.
/// </summary>
public record AttentionRequest
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
