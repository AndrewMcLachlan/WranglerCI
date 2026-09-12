using Asm.Wrangler.Api.Endpoints;
using Xunit;

namespace Wrangler.Tests;

/// <summary>
/// Guards the heartbeat frame the client's stream watchdog depends on. An SSE
/// comment (<c>: keepalive</c>) keeps the socket warm but never reaches
/// JavaScript: EventSource discards comment lines without dispatching anything.
/// Served as a comment, the watchdog starves and force-reconnects every 60
/// seconds with nothing in the logs to explain it.
/// </summary>
public class EventStreamHeartbeatTests
{
    [Fact]
    public void Heartbeat_is_a_named_event_not_a_comment()
    {
        var frame = EventStreamHandler.HeartbeatFrame(DateTimeOffset.UtcNow);

        Assert.StartsWith("event: heartbeat\n", frame);
        Assert.DoesNotContain(": keepalive", frame);
    }

    [Fact]
    public void Heartbeat_carries_a_data_line_so_the_event_dispatches()
    {
        // A frame with no data line is discarded by EventSource without firing
        // the listener.
        var frame = EventStreamHandler.HeartbeatFrame(DateTimeOffset.UtcNow);

        Assert.Contains("\ndata: ", frame);
    }

    [Fact]
    public void Heartbeat_ends_with_the_blank_line_that_terminates_a_frame()
    {
        var frame = EventStreamHandler.HeartbeatFrame(DateTimeOffset.UtcNow);

        Assert.EndsWith("\n\n", frame);
    }

    [Fact]
    public void Heartbeat_reports_when_it_was_sent()
    {
        var sentAt = new DateTimeOffset(2026, 9, 12, 10, 30, 0, TimeSpan.Zero);

        var frame = EventStreamHandler.HeartbeatFrame(sentAt);

        Assert.Contains(sentAt.ToString("O"), frame);
    }
}
