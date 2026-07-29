using System.Text.Json;
using Asm.Wrangler.Api.Services;
using Asm.Wrangler.Api.Webhooks;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;

namespace Asm.Wrangler.Api.Endpoints;

/// <summary>
/// Streams webhook-driven events to connected clients via Server-Sent Events.
/// </summary>
public static class EventStreamHandler
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(25);

    // SSE connections are long-lived, so re-resolve the accessible-repo set periodically rather than
    // only at connect: a user who loses (or gains) repo access has it reflected within this window
    // instead of only after a reconnect. GetAccessibleAsync is cached (~5 min), so this is a cache hit
    // most of the time and a real resolve at most once per interval.
    private static readonly TimeSpan AuthorizationRefreshInterval = TimeSpan.FromMinutes(5);

    // Taking ISubscriberAuthorization (which depends on the user's IGitHubClient) also makes this
    // endpoint reject anonymous connections: resolving IGitHubClient throws when there's no session
    // token, which the exception handler turns into a 401 before streaming starts.
    public static async Task Handle(HttpContext http, IEventBroadcaster broadcaster, ISubscriberAuthorization authorization, IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions> jsonOptions, CancellationToken cancellationToken)
    {
        // Serialize with the app's configured options so the hand-written SSE payload matches the
        // rest of the API's JSON contract: the registered StringEnum converters emit GitHub's raw
        // string tokens (e.g. "completed"/"failure") and WorkflowStatus as its enum name ("Red"),
        // rather than the numbers/objects a bare JsonSerializerDefaults.Web instance would produce.
        var serializerOptions = jsonOptions.Value.SerializerOptions;
        // Kestrel-level buffering defence; X-Accel-Buffering only signals the
        // reverse proxy (App Service front-end / nginx) and won't stop Kestrel
        // from holding writes itself.
        http.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        http.Response.Headers["Content-Type"] = "text/event-stream";
        // no-transform asks intermediaries (App Service front door, any CDN) not
        // to recompress or rechunk the stream.
        http.Response.Headers["Cache-Control"] = "no-cache, no-transform";
        http.Response.Headers["X-Accel-Buffering"] = "no";
        http.Response.Headers.Connection = "keep-alive";

        // Resolve the user's full accessible-repo set at connect time (cached), so events are filtered
        // in-memory below with zero per-event GitHub API calls. Re-resolved periodically (see the
        // heartbeat branch) so access changes are picked up on long-lived connections.
        var accessible = await authorization.GetAccessibleAsync(cancellationToken);
        var nextAuthorizationRefresh = DateTimeOffset.UtcNow + AuthorizationRefreshInterval;

        using var subscription = broadcaster.Subscribe();
        await http.Response.Body.FlushAsync(cancellationToken);

        using var heartbeat = new PeriodicTimer(HeartbeatInterval);
        var heartbeatTask = heartbeat.WaitForNextTickAsync(cancellationToken).AsTask();
        var readTask = subscription.Reader.WaitToReadAsync(cancellationToken).AsTask();

        while (!cancellationToken.IsCancellationRequested)
        {
            var winner = await Task.WhenAny(heartbeatTask, readTask);

            if (winner == heartbeatTask)
            {
                if (!await heartbeatTask) break;

                // Refresh the accessible-repo set on the first heartbeat past the interval, so access
                // revoked (or granted) mid-connection takes effect without requiring a reconnect.
                if (DateTimeOffset.UtcNow >= nextAuthorizationRefresh)
                {
                    accessible = await authorization.GetAccessibleAsync(cancellationToken);
                    nextAuthorizationRefresh = DateTimeOffset.UtcNow + AuthorizationRefreshInterval;
                }

                await http.Response.WriteAsync(": keepalive\n\n", cancellationToken);
                await http.Response.Body.FlushAsync(cancellationToken);
                heartbeatTask = heartbeat.WaitForNextTickAsync(cancellationToken).AsTask();
            }
            else
            {
                if (!await readTask) break;
                while (subscription.Reader.TryRead(out var evt))
                {
                    // Authorization gate: only forward events for repositories this user can actually
                    // see. Events are fanned out to every subscriber, so without this a user would
                    // receive activity metadata (repo names, PR/run ids) for repos they have no access
                    // to. Fails closed — a repo not in the accessible set (or a failed resolve) is
                    // dropped. In-memory check, no per-event API call.
                    if (!accessible.Contains($"{evt.Owner}/{evt.Repo}".ToLowerInvariant())) continue;

                    var payload = JsonSerializer.Serialize(evt, serializerOptions);
                    await http.Response.WriteAsync($"event: {evt.Type}\ndata: {payload}\n\n", cancellationToken);
                    await http.Response.Body.FlushAsync(cancellationToken);
                }
                readTask = subscription.Reader.WaitToReadAsync(cancellationToken).AsTask();
            }
        }
    }
}
