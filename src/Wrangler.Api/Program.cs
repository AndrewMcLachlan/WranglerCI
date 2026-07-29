using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Asm.Wrangler.Api.Authentication;
using Asm.Wrangler.Api.Commands;
using Asm.Wrangler.Api.Endpoints;
using Asm.Wrangler.Api.Exceptions;
using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Models.Attention;
using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Models.Settings;
using Asm.Wrangler.Api.Models.Users;
using Asm.Wrangler.Api.Webhooks;
using Octokit.Webhooks.AspNetCore;
using Asm.Wrangler.Api.OpenApi;
using Asm.Wrangler.Api.Queries;
using Asm.Wrangler.Api.Serialisation;
using Asm.Wrangler.Api.Services;
using Azure.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.OpenApi;
using Octokit;
using Octokit.Caching;
using Postie.AspNetCore;
using StackExchange.Redis;

const string ApiPrefix = "/api";
const string SessionKeyFormat = "gad:{0}:";

return Asm.AspNetCore.WebApplicationStart.Run(args, "Asm.Wrangler.Api", AddServices, AddApp, AddHealthChecks);

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
    builder.Services.AddHttpClient();

    builder.Services.AddScoped<IGitHubClient, GitHubClient>(services =>
    {
        var context = services.GetRequiredService<IHttpContextAccessor>().HttpContext ?? throw new InvalidOperationException("HttpContext is not available. Ensure IHttpContextAccessor is registered and used correctly.");

        var token = context.Session.GetString("github_access_token");

        if (String.IsNullOrEmpty(token)) throw new UnauthorizedException();

        Connection connection = new(new ProductHeaderValue("WranglerCI", "0.1"))
        {
            Credentials = new Credentials(token),
            ResponseCache = services.GetRequiredService<IResponseCache>(),
        };

        return new GitHubClient(connection);
    });

    builder.Services.Configure<GitHubAppOptions>(builder.Configuration.GetSection(GitHubAppOptions.SectionName));

    builder.Services.AddScoped<IDashboardService, DashboardService>();
    builder.Services.AddScoped<ISettingsService, SettingsService>();
    builder.Services.AddScoped<IPullRequestService, PullRequestService>();
    builder.Services.AddScoped<IAttentionService, AttentionService>();
    builder.Services.AddScoped<ISecurityAlertsService, SecurityAlertsService>();
    builder.Services.AddScoped<IGateService, GateService>();
    builder.Services.AddScoped<IUserSearchService, UserSearchService>();
    builder.Services.AddScoped<ISubscriberAuthorization, SubscriberAuthorizationService>();

    // Postie CQRS: scans this assembly for IQueryHandler/ICommandHandler implementations
    // and wires the endpoint dispatcher used by MapQuery/MapCommand.
    builder.Services.AddPostie(typeof(Asm.Wrangler.Api.Queries.Workflows).Assembly);

    // Silently refreshes the GitHub access token before it expires so the ~8-hour token lifetime
    // doesn't repeatedly bounce the user through GitHub's OAuth flow (and its corporate SSO prompt).
    builder.Services.AddSingleton(TimeProvider.System);
    builder.Services.AddScoped<IGitHubTokenService, GitHubTokenService>();
    builder.Services.AddSingleton<ICacheKeyService, CacheKeyService>();
    builder.Services.AddSingleton<IResponseCache, DistributedResponseCache>();
    builder.Services.AddSingleton<IInstallationRegistry, InstallationRegistry>();
    builder.Services.AddSingleton<IRepoVersionService, RepoVersionService>();
    builder.Services.AddSingleton<IEventBroadcaster, EventBroadcaster>();
    builder.Services.AddSingleton<Octokit.Webhooks.WebhookEventProcessor, GitHubWebhookEventProcessor>();

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

                return await ConnectionMultiplexer.ConnectAsync(configurationOptions);
            };

            options.InstanceName = String.Format(CultureInfo.InvariantCulture, SessionKeyFormat, builder.Environment.EnvironmentName);
        });
    }
    else
    {
        builder.Services.AddDistributedMemoryCache();
    }

    var dataProtectionConnectionString = builder.Configuration["DataProtection:StorageConnectionString"];
    if (!String.IsNullOrEmpty(dataProtectionConnectionString))
    {
        builder.Services.AddDataProtection()
            .SetApplicationName("Wrangler")
            .PersistKeysToAzureBlobStorage(dataProtectionConnectionString, "dataprotection", "wrangler-keys.xml")
            .ProtectKeysWithAzureKeyVault(
                new Uri(builder.Configuration["DataProtection:KeyVaultKeyUri"]!),
                new DefaultAzureCredential());
    }

    builder.Services.AddSession(options =>
    {
        options.Cookie.Name = ".GitHub.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
        // Persist the cookie across browser restarts (the default is a session cookie that dies on
        // close) so the refresh token stored in the session survives to be used. Aligned to the
        // refresh token's ~6-month cap.
        options.Cookie.MaxAge = TimeSpan.FromDays(180);
        options.Cookie.IsEssential = true;
        // Sliding server-side lifetime, also aligned to the refresh token's ~6-month cap so the
        // session holding it isn't evicted between visits within the refresh window.
        options.IdleTimeout = TimeSpan.FromDays(180);
    });

    builder.Services.AddAntiforgery(options =>
    {
        options.HeaderName = "RequestVerificationToken";
        options.Cookie.Name = ".GitHub.Antiforgery";
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
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
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<WorkflowStatus>());
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<Asm.Wrangler.Api.Models.PullRequests.CheckStatus>());
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<Asm.Wrangler.Api.Models.Attention.AttentionItemType>());
    });
}

static void AddApp(WebApplication app)
{
    app.UseExceptionHandler();

    app.UseSession();

    // Silently renew the GitHub access token before it expires, only for API requests (static files
    // and the OAuth endpoints don't need it). Must run after UseSession so the session is available.
    app.UseWhen(
        context => context.Request.Path.StartsWithSegments(ApiPrefix),
        branch => branch.UseMiddleware<TokenRefreshMiddleware>());

    app.UseAntiforgery();
    app.UseDefaultFiles();

    // FileExtensionContentTypeProvider's defaults don't include .webmanifest,
    // so without this it would be served as application/octet-stream and
    // browsers would silently reject the PWA manifest.
    var contentTypeProvider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
    contentTypeProvider.Mappings[".webmanifest"] = "application/manifest+json";
    app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypeProvider });

    app.MapOpenApi();

    app.MapGet("/callback/github", CallbackHandler.Handle).ExcludeFromDescription();
    app.MapGet("/login/github", LoginHandler.Handle).ExcludeFromDescription();
    app.MapPost("/logout", (Delegate)LogoutHandler.Handle).ExcludeFromDescription().DisableAntiforgery().AllowAnonymous();

    var webhookSecret = app.Configuration.GetSection(GitHubAppOptions.SectionName)[nameof(GitHubAppOptions.WebhookSecret)];
    app.MapGitHubWebhooks("/webhooks/github", webhookSecret).AllowAnonymous().ExcludeFromDescription().DisableAntiforgery();

    if (app.Environment.IsDevelopment())
    {
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
        }).AllowAnonymous();
    }

    var api = app.MapGroup(ApiPrefix);

    api.MapGet("me", MeHandler.Handle);
    api.MapQuery<Repositories, IEnumerable<Repository>>("repositories");
    api.MapQuery<GroupedRepositories, IEnumerable<AccountModel>>("repositories/grouped");
    api.MapQuery<UserSearch, IEnumerable<UserSearchResult>>("users/search");
    api.MapQuery<Workflows, IEnumerable<RepositoryModel>>("workflows", QueryMethod.Post).DisableAntiforgery();

    api.MapPost("repositories/{owner}/{repo}/workflows/", RepositoriesWorkflowsHandler.Handle)
        .Produces<IEnumerable<WorkflowModel>>()
        .WithNames("Get Workflows for a Repository")
        .DisableAntiforgery();

    api.MapPost("repositories/{owner}/{repo}/workflows/{workflowId}/runs", WorkflowRunsHandler.Handle).DisableAntiforgery();

    api.MapQuery<PullRequests, IEnumerable<PullRequestModel>>("pull-requests", QueryMethod.Post).DisableAntiforgery();
    api.MapCommand<ApprovePullRequests, IEnumerable<ApprovalResult>>("pull-requests/approve");

    api.MapQuery<Attention, IEnumerable<AttentionItem>>("attention", QueryMethod.Post).DisableAntiforgery();
    api.MapQuery<Gates, IEnumerable<DeploymentGateModel>>("gates", QueryMethod.Post).DisableAntiforgery();
    api.MapCommand<ApproveGates, IEnumerable<GateApprovalResult>>("gates/approve");

    api.MapGet("events/stream", EventStreamHandler.Handle).ExcludeFromDescription();

    app.UseSecurityHeaders();

    app.MapFallbackToFile("/index.html");
}

static void AddHealthChecks(IHealthChecksBuilder healthChecks, WebApplicationBuilder builder)
{
}
