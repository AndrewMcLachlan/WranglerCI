import { dehydrate, hydrate, type DehydratedState, type Query, type QueryClient } from "@tanstack/react-query";
import type { StorageLike } from "./routes/settings/-hooks/repositoryFeatures";

/**
 * Snapshots the query cache into localStorage and restores it before the first
 * render, so the last rendered dashboard is on screen immediately on the next
 * visit while its refetch runs behind it.
 */

export const QUERY_CACHE_STORAGE_KEY = "wrangler.queryCache";

/** Bump when the persisted shape changes; older snapshots are then discarded. */
export const QUERY_CACHE_VERSION = 1;

/** Snapshots older than this are discarded. Matches the gcTime in QUERY_DEFAULTS. */
export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * localStorage is a ~5MB budget shared with the app's settings; an oversized
 * snapshot is skipped so it can never cost a settings write.
 */
export const QUERY_CACHE_MAX_CHARS = 2_000_000;

/** Coalesces the burst of cache events a fetch or a stream push produces. */
const PERSIST_DEBOUNCE_MS = 1000;

/** Root query keys whose data is worth restoring. */
export const PERSISTED_QUERY_KEYS = [
  "getWorkflows",
  "getWorkflowRuns",
  "pullRequests",
  "attention",
  "gates",
] as const;

interface QueryCacheSnapshot {
  version: number;
  savedAt: number;
  state: DehydratedState;
}

const isPersistable = (query: Query): boolean => {
  if (query.state.status !== "success") return false;
  const root = query.queryKey[0];
  return typeof root === "string" && (PERSISTED_QUERY_KEYS as readonly string[]).includes(root);
};

/**
 * Writes the persistable part of the cache to storage. A failure only costs the
 * next visit a spinner.
 */
export const saveQueryCache = (queryClient: QueryClient, storage: StorageLike): boolean => {
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: isPersistable,
    shouldDehydrateMutation: () => false,
  });

  if (state.queries.length === 0) {
    // Drop the old snapshot so it can't outlive the state it described.
    storage.removeItem(QUERY_CACHE_STORAGE_KEY);
    return false;
  }

  const snapshot: QueryCacheSnapshot = { version: QUERY_CACHE_VERSION, savedAt: Date.now(), state };

  let json: string;
  try {
    json = JSON.stringify(snapshot);
  } catch {
    return false;
  }

  if (json.length > QUERY_CACHE_MAX_CHARS) return false;

  try {
    storage.setItem(QUERY_CACHE_STORAGE_KEY, json);
    return true;
  } catch {
    // Clear the key so a stale snapshot isn't restored as if it were current.
    try {
      storage.removeItem(QUERY_CACHE_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
    return false;
  }
};

/**
 * Restores a snapshot into `queryClient`. Must run before the first render, so
 * the first paint already has data.
 *
 * Restored queries are marked stale so each refetches as its page mounts: the
 * stream was not running while the app was closed and the broadcaster keeps no
 * buffer, so a snapshot can never be assumed current.
 */
export const restoreQueryCache = (
  queryClient: QueryClient,
  storage: StorageLike,
  now: number = Date.now(),
): boolean => {
  let raw: string | null;
  try {
    raw = storage.getItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  const discard = () => {
    try {
      storage.removeItem(QUERY_CACHE_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
  };

  let snapshot: QueryCacheSnapshot;
  try {
    snapshot = JSON.parse(raw) as QueryCacheSnapshot;
  } catch {
    discard();
    return false;
  }

  const usable =
    !!snapshot &&
    snapshot.version === QUERY_CACHE_VERSION &&
    typeof snapshot.savedAt === "number" &&
    !!snapshot.state &&
    Array.isArray(snapshot.state.queries) &&
    now - snapshot.savedAt <= QUERY_CACHE_MAX_AGE;

  if (!usable) {
    discard();
    return false;
  }

  hydrate(queryClient, snapshot.state);

  for (const queryKey of PERSISTED_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: "none" });
  }

  return true;
};

/**
 * Drops the snapshot. Logout must call this: queryClient.clear() empties only
 * the in-memory cache, and the snapshot outlives the page — it would be
 * restored for whoever signs in next.
 */
export const clearQueryCacheSnapshot = (storage: StorageLike): void => {
  try {
    storage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }
};

export interface QueryCachePersistence {
  /** Write the current cache immediately, outside the debounce. */
  flush: () => void;
  /** Stop persisting (cancels any pending write). */
  stop: () => void;
}

/**
 * Keeps the stored snapshot in step with the cache: a debounced write on cache
 * changes, and an immediate one as the page goes away — a backgrounded tab can
 * be killed without another turn of the event loop, and a reload can beat the
 * debounce.
 */
export const startPersistingQueryCache = (
  queryClient: QueryClient,
  storage: StorageLike,
  debounceMs: number = PERSIST_DEBOUNCE_MS,
): QueryCachePersistence => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    saveQueryCache(queryClient, storage);
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      saveQueryCache(queryClient, storage);
    }, debounceMs);
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(schedule);

  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };

  // A reload typically fires pagehide without a visibilitychange, so both.
  const hasDocument = typeof document !== "undefined";
  if (hasDocument) {
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
  }

  return {
    flush,
    stop: () => {
      unsubscribe();
      if (hasDocument) {
        document.removeEventListener("visibilitychange", onHide);
        window.removeEventListener("pagehide", flush);
      }
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
};
