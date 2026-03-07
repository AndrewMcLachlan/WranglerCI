using Asm.Wrangler.Api.Exceptions;
using Asm.Wrangler.Api.Services;

namespace Asm.Wrangler.Api.Extensions;

/// <summary>
/// Extension methods for registering GraphQL services.
/// </summary>
public static class GraphQLServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="IGraphQLService"/> and the GraphQL connection in the service collection.
    /// </summary>
    public static IServiceCollection AddGraphQLServices(this IServiceCollection services) =>
        services
            .AddScoped<IGraphQLService, GraphQLService>()
            .AddScoped(services =>
            {
                var context = services.GetRequiredService<IHttpContextAccessor>().HttpContext ?? throw new InvalidOperationException("HttpContext is not available. Ensure IHttpContextAccessor is registered and used correctly.");
                var token = context.Session.GetString("github_access_token");

                if (String.IsNullOrEmpty(token)) throw new UnauthorizedException();

                Octokit.GraphQL.Connection connection = new(new Octokit.GraphQL.ProductHeaderValue("WranglerCI", "0.1"), token);

                return connection;
            });
}
