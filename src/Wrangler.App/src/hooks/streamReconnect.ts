/**
 * Pure support for recovering the SSE stream's cache gap on reconnect. No React
 * and no EventSource access, so it is unit-testable in a node environment
 * alongside the other pure stream helpers (mergeWorkflowRun, mergePullRequest).
 */

/**
 * The query caches the stream writes into (see useGitHubEventStream). A missed
 * event can only leave these stale, so they are the only ones worth resyncing on
 * reconnect. Attention and Gates are not stream-backed and self-heal via their
 * own refetchInterval, so refetching them here would spend GitHub quota for
 * nothing.
 */
export const STREAM_BACKED_QUERY_KEYS: readonly (readonly string[])[] = [
  ["getWorkflows"],
  ["getWorkflowRuns"],
  ["pullRequests"],
];

/**
 * How long the stream may go silent before it is presumed dead. The server
 * heartbeats every 25s, so this allows two missed beats and some slack.
 */
export const STREAM_SILENCE_TIMEOUT_MS = 60 * 1000;

/**
 * How long to wait for a sign of life on a connection that has already been
 * rebuilt this many times without ever waking up. Every rebuild resyncs each
 * stream-backed cache, so the wait has to grow — but it stays capped, because a
 * stream that is broken now may not be in ten minutes.
 */
export const silenceTimeoutFor = (consecutiveSilentRebuilds: number): number =>
  STREAM_SILENCE_TIMEOUT_MS * 2 ** Math.min(consecutiveSilentRebuilds, 3);

export interface StreamWatchdog {
  /** Record that the stream produced something. Restarts the countdown. */
  recordActivity: () => void;
  /** Stop watching. */
  stop: () => void;
}

/**
 * Watches for a stream that has stopped producing anything — including the
 * server's heartbeat.
 *
 * A half-open connection (a proxy dropping traffic, a device resuming from
 * sleep) leaves EventSource reporting OPEN with no error ever firing, so
 * silence is the only evidence available. onSilence fires once: recovery means
 * rebuilding the connection, and a rebuilt connection gets its own watchdog.
 */
export const createStreamWatchdog = (
  onSilence: () => void,
  timeoutMs: number = STREAM_SILENCE_TIMEOUT_MS,
): StreamWatchdog => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const arm = () => {
    timer = setTimeout(() => {
      timer = undefined;
      onSilence();
    }, timeoutMs);
  };

  arm();

  return {
    recordActivity: () => {
      stop();
      arm();
    },
    stop,
  };
};

export interface ReconnectTracker {
  /** Record that the connection dropped. EventSource then retries on its own. */
  onError: () => void;
  /** Returns true when this open follows a drop — i.e. a genuine reconnect. */
  onOpen: () => boolean;
}

/**
 * Tracks whether an EventSource open is the initial connect or a reconnect after
 * a drop.
 *
 * The stream sends no `id:` field and the broadcaster keeps no buffer, so there
 * is no Last-Event-ID replay: events delivered while the connection was down are
 * lost permanently. The only recovery is to refetch, but refetching on *every*
 * open would duplicate the fetch the queries just did on mount. Hence the
 * distinction — the first open resyncs nothing, a reconnect resyncs.
 *
 * Failed retries only fire onError; onOpen fires solely on a successful
 * connection, so an outage produces exactly one resync when it recovers rather
 * than one per retry attempt.
 */
export const createReconnectTracker = (startDisconnected: boolean = false): ReconnectTracker => {
  let sawDisconnect = startDisconnected;

  return {
    onError: () => {
      sawDisconnect = true;
    },
    onOpen: () => {
      const resync = sawDisconnect;
      sawDisconnect = false;
      return resync;
    },
  };
};
