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
export const createReconnectTracker = (): ReconnectTracker => {
  let sawDisconnect = false;

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
