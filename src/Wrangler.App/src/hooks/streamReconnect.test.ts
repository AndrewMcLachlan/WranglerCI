import { describe, it, expect } from "vitest";
import { createReconnectTracker, STREAM_BACKED_QUERY_KEYS } from "./streamReconnect";

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
    ]);
  });
});
