using System.Text.Json.Serialization;

namespace Asm.Wrangler.Api.GraphQL;

internal record QueryBody
{
    [JsonPropertyName("query")]
    public required string Query { get; init; }
}
