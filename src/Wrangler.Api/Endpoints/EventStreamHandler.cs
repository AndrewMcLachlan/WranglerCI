using System.Text.Json;
using Asm.Wrangler.Api.Services;
using Asm.Wrangler.Api.Webhooks;
using Microsoft.AspNetCore.Http.Features;

namespace Asm.Wrangler.Api.Endpoints;

/// <summary>
/// Streams webhook-driven events to connected clients via Server-Sent Events.
/// </summary>
public static class EventStreamHandler
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(25);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // Taking IRepositoryAccessService (which depends on the user's IGitHubClient) also makes this
    // endpoint reject anonymous connections: resolving IGitHubClient throws when there's no session
    // token, which the exception handler turns into a 401 before streaming starts.
    public static async Task Handle(HttpContext http, IEventBroadcaster broadcaster, IRepositoryAccessService access, CancellationToken cancellationToken)
    {
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
                    // to. Fails closed — a repo the user can't access (or a failed check) is dropped.
                    if (!await access.CanAccessAsync(evt.Owner, evt.Repo, cancellationToken)) continue;

                    var payload = JsonSerializer.Serialize(evt, JsonOptions);
                    await http.Response.WriteAsync($"event: {evt.Type}\ndata: {payload}\n\n", cancellationToken);
                    await http.Response.Body.FlushAsync(cancellationToken);
                }
                readTask = subscription.Reader.WaitToReadAsync(cancellationToken).AsTask();
            }
        }
    }
}
