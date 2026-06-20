namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to list pending deployment gates across repositories.</summary>
public record GatesRequest
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
