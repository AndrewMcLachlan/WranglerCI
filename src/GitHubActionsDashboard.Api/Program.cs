using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Identity;
using GitHubActionsDashboard.Api.Exceptions;
using GitHubActionsDashboard.Api.Handlers;
using GitHubActionsDashboard.Api.Models;
using GitHubActionsDashboard.Api.Models.Dashboard;
using GitHubActionsDashboard.Api.Models.PullRequests;
using GitHubActionsDashboard.Api.OpenApi;
using GitHubActionsDashboard.Api.Serialisation;
using GitHubActionsDashboard.Api.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.OpenApi;
using Octokit;
using Octokit.Caching;
using StackExchange.Redis;

const string ApiPrefix = "/api";
const string SessionKeyFormat = "gad:{0}:";

return Asm.AspNetCore.WebApplicationStart.Run(args, "GitHubActionsDashboard.Api", AddServices, AddApp, AddHealthChecks);

static void AddServices(WebApplicationBuilder builder)
{
    if (builder.Environment.IsDevelopment())
    {
        builder.Logging.AddConsole();
        builder.Logging.AddDebug();
    }

    builder.Services.Configure<JsonOptions>(options =>
    {
        options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;

        // Add converters for Octokit StringEnum types
        options.SerializerOptions.Converters.Add(new StringEnumJsonConverter<WorkflowState>());
        options.SerializerOptions.Converters.Add(new StringEnumJsonConverter<WorkflowRunStatus>());
        options.SerializerOptions.Converters.Add(new StringEnumJsonConverter<WorkflowRunConclusion>());
        options.SerializerOptions.Converters.Add(new StringEnumJsonConverter<ItemState>());
        options.SerializerOptions.Converters.Add(new StringEnumJsonConverter<RepositoryVisibility>());
        options.SerializerOptions.Converters.Add(new StringEnumJsonConverter<MergeableState>());

    });

    builder.Services.AddHttpContextAccessor();

    builder.Services.AddScoped<IGitHubClient, GitHubClient>(services =>
    {
        var context = services.GetRequiredService<IHttpContextAccessor>().HttpContext ?? throw new InvalidOperationException("HttpContext is not available. Ensure IHttpContextAccessor is registered and used correctly.");

        var token = context.Session.GetString("github_access_token");

        if (String.IsNullOrEmpty(token)) throw new UnauthorizedException();

        Connection connection = new(new ProductHeaderValue("GitHubActionsDashboard", "0.1"))
        {
            Credentials = new Credentials(token),
            ResponseCache = services.GetRequiredService<IResponseCache>(),
        };

        return new GitHubClient(connection);
    });

    builder.Services.AddScoped<IDashboardService, DashboardService>();
    builder.Services.AddScoped<ISettingsService, SettingsService>();
    builder.Services.AddScoped<IPullRequestService, PullRequestService>();
    builder.Services.AddSingleton<ICacheKeyService, CacheKeyService>();
    builder.Services.AddSingleton<IResponseCache, DistributedResponseCache>();

    builder.Services.AddOpenApi("v1", options =>
    {
        options.OpenApiVersion = Microsoft.OpenApi.OpenApiSpecVersion.OpenApi3_1;
        options.AddSchemaTransformer<StringEnumSchemaTransformer>();
        options.AddDocumentTransformer((document, context, cancellationToken) =>
        {
            // Remove /api prefix from all paths
            var newPaths = new Dictionary<string, IOpenApiPathItem>();
            foreach (var path in document.Paths)
            {
                var newPath = path.Key.StartsWith(ApiPrefix) ? new KeyValuePair<string, IOpenApiPathItem>(path.Key[ApiPrefix.Length..], path.Value) : path;
                newPaths.Add(path.Key.StartsWith(ApiPrefix) ? path.Key[ApiPrefix.Length..] : path.Key, path.Value);
               
            }
            document.Paths.Clear();
            foreach (var path in newPaths)
            {
                document.Paths.Add(path.Key, path.Value);
            }

            return Task.CompletedTask;
        });
    });

    var redisConnectionString = builder.Configuration.GetConnectionString("Redis");

    if (!String.IsNullOrEmpty(redisConnectionString))
    {
        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.ConnectionMultiplexerFactory = async () =>
            {
                var connectionString = builder.Configuration.GetConnectionString("Redis");

                var configurationOptions = ConfigurationOptions.Parse(connectionString!);
                configurationOptions.AbortOnConnectFail = false;
                configurationOptions.ConnectTimeout = 10000;
                configurationOptions.SyncTimeout = 5000;
                configurationOptions.ConnectRetry = 3;

                await configurationOptions.ConfigureForAzureWithTokenCredentialAsync(new DefaultAzureCredential());

                return await ConnectionMultiplexer.ConnectAsync(configurationOptions); ;
            };

            options.InstanceName = String.Format(CultureInfo.InvariantCulture, SessionKeyFormat, builder.Environment.EnvironmentName);
        });
    }
    else
    {
        builder.Services.AddDistributedMemoryCache();
    }

    builder.Services.AddSession(options =>
    {
        options.Cookie.Name = ".GitHub.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.IdleTimeout = TimeSpan.FromDays(7);
    });

    builder.Services.AddProblemDetails(options =>
    {
        options.CustomizeProblemDetails = (context) =>
        {
            var exception = context.HttpContext.Features.Get<IExceptionHandlerFeature>()?.Error;
            if (exception is not null)
            {
                // Add exception details
                context.ProblemDetails.Extensions["exceptionType"] = exception.GetType().Name;
                context.ProblemDetails.Extensions["exceptionMessage"] = exception.Message;

                // Include stack trace in development
                if (context.HttpContext.RequestServices.GetService<IWebHostEnvironment>()?.IsDevelopment() == true)
                {
                    context.ProblemDetails.Extensions["stackTrace"] = exception.StackTrace;
                    context.ProblemDetails.Extensions["innerException"] = exception.InnerException?.ToString();
                }

                // Add custom properties for specific exception types
                if (exception is UnauthorizedException)
                {
                    context.ProblemDetails.Extensions["authenticationRequired"] = true;
                }
            }

            // Add request information
            context.ProblemDetails.Extensions["requestId"] = context.HttpContext.TraceIdentifier;
            context.ProblemDetails.Extensions["timestamp"] = DateTimeOffset.UtcNow;
            context.ProblemDetails.Extensions["path"] = context.HttpContext.Request.Path;
            context.ProblemDetails.Extensions["method"] = context.HttpContext.Request.Method;
        };
    });

    builder.Services.AddExceptionHandler(options =>
    {
        options.StatusCodeSelector = (ex) =>
        {
            if (ex is UnauthorizedException or AuthorizationException) return StatusCodes.Status401Unauthorized;
            return StatusCodes.Status500InternalServerError;
        };
    });

    builder.Services.Configure<JsonOptions>(options =>
    {
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<RagStatus>());
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<GitHubActionsDashboard.Api.Models.PullRequests.CheckStatus>());
    });
}

static void AddApp(WebApplication app)
{
    app.UseExceptionHandler();

    app.UseSession();
    app.UseDefaultFiles();
    app.UseStaticFiles();

    app.MapOpenApi();

    app.MapGet("/callback/github", CallbackHandler.Handle).ExcludeFromDescription();
    app.MapGet("/login/github", LoginHandler.Handle).ExcludeFromDescription();

    app.MapGet("/admin/session/debug", (ICacheKeyService service, HttpContext context) =>
    {
        // Force session to be created/loaded
        context.Session.SetString("debug-test", DateTime.UtcNow.ToString());

        return Results.Ok(new
        {
            sessionId = context.Session.Id,
            expectedSessionKey = String.Format(CultureInfo.InvariantCulture, SessionKeyFormat, app.Environment.EnvironmentName),
            expectedRedisKey = service.GetCacheKey(String.Empty),
            cookieName = ".GitHub.Session",
            sessionAvailable = context.Session.IsAvailable
        });
    });

    var api = app.MapGroup(ApiPrefix);

    api.MapGet("repositories", RepositoriesHandler.Handle);
    api.MapGet("repositories/grouped", GroupedRepositoriesHandler.Handle);
    api.MapPost("workflows", WorkflowsHandler.Handle);

    api.MapPost("repositories/{owner}/{repo}/workflows/", RepositoriesWorkflowsHandler.Handle)
        .Produces<IEnumerable<WorkflowModel>>()
        .WithNames("Get Workflows for a Repository");

    api.MapPost("repositories/{owner}/{repo}/workflows/{workflowId}/runs", WorkflowRunsHandler.Handle);

    api.MapPost("pull-requests", PullRequestsHandler.Handle);
    api.MapPost("pull-requests/approve", ApprovePullRequestsHandler.Handle);

    app.UseSecurityHeaders();

    app.MapFallbackToFile("/index.html");
}

static void AddHealthChecks(IHealthChecksBuilder healthChecks, WebApplicationBuilder builder)
{
}
