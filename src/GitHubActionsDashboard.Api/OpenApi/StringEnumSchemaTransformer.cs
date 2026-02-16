using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using Octokit;

namespace GitHubActionsDashboard.Api.OpenApi;

/// <summary>
/// OpenAPI schema transformer that converts Octokit <c>StringEnum&lt;T&gt;</c> types to plain string schemas.
/// </summary>
public class StringEnumSchemaTransformer : IOpenApiSchemaTransformer
{
    /// <inheritdoc />
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        if (IsStringEnumSchema(context))
        {
            schema.Type = JsonSchemaType.String;
            schema.Properties?.Clear();
            schema.AllOf?.Clear();
            schema.OneOf?.Clear();
            schema.AnyOf?.Clear();
            schema.Items = null;
            schema.AdditionalProperties = null;
        }
        return Task.CompletedTask;
    }

    private static bool IsStringEnumSchema(OpenApiSchemaTransformerContext context)
    {
        var type = context.JsonTypeInfo.Type;

        return type.IsGenericType &&
               (type.GetGenericTypeDefinition() == typeof(StringEnum<>) ||
               type.GetGenericTypeDefinition() == typeof(Nullable<>) &&
               type.GetGenericArguments()[0].IsGenericType &&
               type.GetGenericArguments()[0].GetGenericTypeDefinition() == typeof(StringEnum<>));
    }
}
