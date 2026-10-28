import { describe, it, expect } from "vitest";
import { createReconnectTracker, isSilent, reopenDelayFor, STREAM_BACKED_QUERY_KEYS, STREAM_SILENCE_TIMEOUT_MS } from "./streamReconnect";

describe("createReconnectTracker", () => {
  it("does not resync on the initial connect", () => {
    const tracker = createReconnectTracker();
    expect(tracker.onOpen()).toBe(false);
  });

  it("resyncs on an open that follows a drop", () => {
    const tracker = createReconnectTracker();
    tracker.onOpen();
    tracker.onError();

    expect(tracker.onOpen()).toBe(true);
  });

  it("resyncs once per outage, not once per failed retry", () => {
    const tracker = createReconnectTracker();
    tracker.onOpen();
    // EventSource fires onerror for every failed retry while the server is down;
    // onopen only fires once the connection is actually re-established.
    tracker.onError();
    tracker.onError();
    tracker.onError();

    expect(tracker.onOpen()).toBe(true);
  });

  it("does not resync again on a subsequent open with no drop in between", () => {
    const tracker = createReconnectTracker();
    tracker.onError();
    expect(tracker.onOpen()).toBe(true);
    expect(tracker.onOpen()).toBe(false);
  });

  it("resyncs again on a second, separate outage", () => {
    const tracker = createReconnectTracker();
    tracker.onOpen();

    tracker.onError();
    expect(tracker.onOpen()).toBe(true);

    tracker.onError();
    expect(tracker.onOpen()).toBe(true);
  });

  it("resyncs on the first open when the stream is being rebuilt", () => {
    // A rebuild only happens because the previous connection went silent, so
    // its first open is a reconnect and the caches missed whatever fell in the
    // gap.
    const tracker = createReconnectTracker(true);

    expect(tracker.onOpen()).toBe(true);
    expect(tracker.onOpen()).toBe(false);
  });

  it("tracks each stream independently", () => {
    const first = createReconnectTracker();
    const second = createReconnectTracker();
    first.onError();

    expect(second.onOpen()).toBe(false);
    expect(first.onOpen()).toBe(true);
  });
});

describe("STREAM_BACKED_QUERY_KEYS", () => {
  it("covers exactly the caches the stream writes into", () => {
    expect(STREAM_BACKED_QUERY_KEYS.map(([key]) => key)).toEqual([
      "getWorkflows",
      "getWorkflowRuns",
      "pullRequests",
      "gates",
    ]);
  });
});

describe("reopenDelayFor", () => {
  it("retries soon after the first failure", () => {
    expect(reopenDelayFor(0)).toBe(2000);
  });

  it("backs off with each failure in a row", () => {
    expect(reopenDelayFor(1)).toBe(4000);
    expect(reopenDelayFor(2)).toBe(8000);
  });

  it("never waits longer than the silence timeout", () => {
    expect(reopenDelayFor(20)).toBe(STREAM_SILENCE_TIMEOUT_MS);
  });
});

describe("isSilent", () => {
  it("trusts a stream heard from within the timeout", () => {
    expect(isSilent(0, STREAM_SILENCE_TIMEOUT_MS)).toBe(false);
  });

  it("presumes a stream quiet for longer than the timeout is dead", () => {
    expect(isSilent(0, STREAM_SILENCE_TIMEOUT_MS + 1)).toBe(true);
  });
});
