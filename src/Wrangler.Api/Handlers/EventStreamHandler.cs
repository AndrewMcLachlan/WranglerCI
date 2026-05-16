using System.Text.Json;
using Asm.Wrangler.Api.Webhooks;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Streams webhook-driven events to connected clients via Server-Sent Events.
/// </summary>
public static class EventStreamHandler
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(25);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task Handle(HttpContext http, IEventBroadcaster broadcaster, CancellationToken cancellationToken)
    {
        http.Response.Headers["Content-Type"] = "text/event-stream";
        http.Response.Headers["Cache-Control"] = "no-cache";
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
                    var payload = JsonSerializer.Serialize(evt, JsonOptions);
                    await http.Response.WriteAsync($"event: {evt.Type}\ndata: {payload}\n\n", cancellationToken);
                    await http.Response.Body.FlushAsync(cancellationToken);
                }
                readTask = subscription.Reader.WaitToReadAsync(cancellationToken).AsTask();
            }
        }
    }
}
