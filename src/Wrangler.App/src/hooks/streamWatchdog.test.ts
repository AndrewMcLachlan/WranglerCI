import { describe, it, expect, vi, afterEach } from "vitest";
import { createStreamWatchdog, silenceTimeoutFor, STREAM_SILENCE_TIMEOUT_MS } from "./streamReconnect";

/**
 * The failure these protect: an SSE connection that dies without erroring —
 * a proxy or a sleeping device leaves the socket half-open, EventSource still
 * reports OPEN, onerror never fires, and the dashboard quietly stops updating.
 * The server's heartbeat is the only proof the stream is alive.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("the stream watchdog", () => {
  it("reports silence once the heartbeat stops arriving", () => {
    vi.useFakeTimers();
    const onSilence = vi.fn();
    createStreamWatchdog(onSilence);

    vi.advanceTimersByTime(STREAM_SILENCE_TIMEOUT_MS);

    expect(onSilence).toHaveBeenCalledTimes(1);
  });

  it("stays quiet while heartbeats keep arriving", () => {
    vi.useFakeTimers();
    const onSilence = vi.fn();
    const watchdog = createStreamWatchdog(onSilence);

    for (let beat = 0; beat < 10; beat++) {
      vi.advanceTimersByTime(STREAM_SILENCE_TIMEOUT_MS - 1000);
      watchdog.recordActivity();
    }
    vi.advanceTimersByTime(STREAM_SILENCE_TIMEOUT_MS - 1);

    expect(onSilence).not.toHaveBeenCalled();
  });

  it("reports once and waits to be rebuilt rather than firing on a loop", () => {
    vi.useFakeTimers();
    const onSilence = vi.fn();
    createStreamWatchdog(onSilence);

    vi.advanceTimersByTime(STREAM_SILENCE_TIMEOUT_MS * 5);

    expect(onSilence).toHaveBeenCalledTimes(1);
  });

  it("stops watching when the stream is torn down", () => {
    vi.useFakeTimers();
    const onSilence = vi.fn();
    const watchdog = createStreamWatchdog(onSilence);

    watchdog.stop();
    vi.advanceTimersByTime(STREAM_SILENCE_TIMEOUT_MS * 2);

    expect(onSilence).not.toHaveBeenCalled();
  });

  it("allows more time than the server's 25s heartbeat interval", () => {
    expect(STREAM_SILENCE_TIMEOUT_MS).toBeGreaterThan(25 * 1000 * 2);
  });
});

describe("backing off a stream that will not wake up", () => {
  it("waits the full timeout on a connection that has not been rebuilt", () => {
    expect(silenceTimeoutFor(0)).toBe(STREAM_SILENCE_TIMEOUT_MS);
  });

  it("waits longer after each rebuild that stays silent", () => {
    expect(silenceTimeoutFor(1)).toBeGreaterThan(silenceTimeoutFor(0));
    expect(silenceTimeoutFor(2)).toBeGreaterThan(silenceTimeoutFor(1));
  });

  it("caps the wait so a broken stream still recovers on its own", () => {
    // Each rebuild resyncs every stream-backed cache, so an unbounded loop
    // would spend GitHub quota every minute for as long as the tab is open —
    // but a stream that never comes back still has to keep trying.
    const capped = silenceTimeoutFor(99);

    expect(capped).toBe(silenceTimeoutFor(3));
    expect(capped).toBeLessThanOrEqual(10 * 60 * 1000);
  });
});
