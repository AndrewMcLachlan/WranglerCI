import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import { QUERY_DEFAULTS } from "./queryDefaults";
import {
  QUERY_CACHE_MAX_AGE,
  QUERY_CACHE_MAX_CHARS,
  QUERY_CACHE_STORAGE_KEY,
  QUERY_CACHE_VERSION,
  clearQueryCacheSnapshot,
  restoreQueryCache,
  saveQueryCache,
  startPersistingQueryCache,
} from "./queryCachePersistence";
import type { StorageLike } from "./routes/settings/-hooks/repositoryFeatures";

/**
 * The scenario these protect: the dashboard has rendered once, then the tab is
 * reloaded (or the PWA is relaunched, or a mobile browser discards the
 * backgrounded tab). The in-memory cache is gone, so without a snapshot the
 * user is back to a spinner and a cold fetch of every selected workflow.
 */

const fakeStorage = (initial: Record<string, string> = {}): StorageLike & { store: Map<string, string> } => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
  };
};

const client = () => new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });

const workflowsOptions = {
  queryKey: ["getWorkflows", [{ owner: "acme", name: "site" }], []],
  queryFn: async () => ["run:green"],
};

/** Mounting the dashboard: what the user sees on the first render. */
const mount = (queryClient: QueryClient) => {
  const observer = new QueryObserver<string[]>(queryClient, workflowsOptions as never);
  const unsubscribe = observer.subscribe(() => { });
  return { observer, unsubscribe };
};

const firstVisit = async (storage: StorageLike) => {
  const queryClient = client();
  const persistence = startPersistingQueryCache(queryClient, storage, 0);
  const visit = mount(queryClient);
  await vi.advanceTimersByTimeAsync(0);
  persistence.flush();
  visit.unsubscribe();
  persistence.stop();
  return queryClient;
};

afterEach(() => {
  vi.useRealTimers();
});

describe("a reload after the dashboard has rendered once", () => {
  it("renders the previous data with no spinner, and refetches behind it", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    await firstVisit(storage);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();

    // Reload: a brand new QueryClient, nothing in memory.
    const reloaded = client();
    expect(restoreQueryCache(reloaded, storage)).toBe(true);

    // The very first render of the dashboard already has data.
    const visit = mount(reloaded);
    const first: QueryObserverResult<string[]> = visit.observer.getCurrentResult();
    expect(first.isLoading).toBe(false);
    expect(first.data).toEqual(["run:green"]);

    // ...and it is refreshing, even though the snapshot is younger than the
    // query's staleTime: the stream was down while the app was closed, so the
    // restored data can't be assumed current.
    expect(first.isFetching).toBe(true);
    visit.unsubscribe();
  });

  it("keeps the snapshot in step with stream pushes", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    const queryClient = client();
    const persistence = startPersistingQueryCache(queryClient, storage, 1000);
    const visit = mount(queryClient);
    await vi.advanceTimersByTimeAsync(0);

    // How useGitHubEventStream applies a pushed workflow_run.
    queryClient.setQueryData<string[]>(workflowsOptions.queryKey, (data) =>
      data ? [...data, "run:red(pushed)"] : data);
    await vi.advanceTimersByTimeAsync(1000);

    visit.unsubscribe();
    persistence.stop();

    const reloaded = client();
    restoreQueryCache(reloaded, storage);
    expect(reloaded.getQueryData(workflowsOptions.queryKey)).toEqual(["run:green", "run:red(pushed)"]);
  });

  it("writes immediately when the page is hidden, without waiting out the debounce", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    const queryClient = client();
    const persistence = startPersistingQueryCache(queryClient, storage, 60_000);
    const visit = mount(queryClient);
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();

    persistence.flush();
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).not.toBeNull();

    visit.unsubscribe();
    persistence.stop();
  });

  it("stops writing once stopped", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    const queryClient = client();
    const persistence = startPersistingQueryCache(queryClient, storage, 0);
    persistence.stop();

    const visit = mount(queryClient);
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    visit.unsubscribe();
  });
});

describe("what gets persisted", () => {
  it("stores list data but not one-off or failed queries", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    const queryClient = client();

    const observers = [
      new QueryObserver(queryClient, { queryKey: ["getWorkflows"], queryFn: async () => ["run"] } as never),
      new QueryObserver(queryClient, { queryKey: ["userSearch", "and"], queryFn: async () => ["andrew"] } as never),
      new QueryObserver(queryClient, {
        queryKey: ["pullRequests"],
        queryFn: async () => { throw new Error("GitHub is having a moment"); },
        retry: false,
      } as never),
    ].map((observer) => observer.subscribe(() => { }));

    await vi.advanceTimersByTimeAsync(0);
    saveQueryCache(queryClient, storage);
    for (const unsubscribe of observers) unsubscribe();

    const reloaded = client();
    restoreQueryCache(reloaded, storage);
    expect(reloaded.getQueryData(["getWorkflows"])).toEqual(["run"]);
    expect(reloaded.getQueryData(["userSearch", "and"])).toBeUndefined();
    expect(reloaded.getQueryData(["pullRequests"])).toBeUndefined();
  });

  it("clears the snapshot when there is no longer anything worth restoring", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    await firstVisit(storage);

    // e.g. the user deselected every repository, so the cache holds no lists.
    expect(saveQueryCache(client(), storage)).toBe(false);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it("skips a snapshot too large for the localStorage budget", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    const queryClient = client();

    const visit = new QueryObserver(queryClient, {
      queryKey: ["getWorkflows"],
      queryFn: async () => ["x".repeat(QUERY_CACHE_MAX_CHARS + 1)],
    } as never).subscribe(() => { });
    await vi.advanceTimersByTimeAsync(0);

    expect(saveQueryCache(queryClient, storage)).toBe(false);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    visit();
  });

  it("survives storage refusing the write", async () => {
    vi.useFakeTimers();
    const removed: string[] = [];
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new DOMException("QuotaExceededError"); },
      removeItem: (key) => { removed.push(key); },
    };

    const queryClient = client();
    const visit = mount(queryClient);
    await vi.advanceTimersByTimeAsync(0);

    expect(saveQueryCache(queryClient, storage)).toBe(false);
    expect(removed).toContain(QUERY_CACHE_STORAGE_KEY);
    visit.unsubscribe();
  });
});

describe("a snapshot that should not be restored", () => {
  const restoreFrom = (value: string) => {
    const storage = fakeStorage({ [QUERY_CACHE_STORAGE_KEY]: value });
    const queryClient = client();
    const restored = restoreQueryCache(queryClient, storage);
    return { restored, storage, queryClient };
  };

  it("ignores and clears a corrupt entry", () => {
    const { restored, storage } = restoreFrom("{not json");
    expect(restored).toBe(false);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it("ignores and clears a snapshot from an older version", () => {
    const { restored, storage } = restoreFrom(JSON.stringify({
      version: QUERY_CACHE_VERSION - 1,
      savedAt: Date.now(),
      state: { queries: [], mutations: [] },
    }));
    expect(restored).toBe(false);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it("ignores a snapshot older than the max age rather than showing stale builds", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    await firstVisit(storage);

    const queryClient = client();
    const restored = restoreQueryCache(queryClient, storage, Date.now() + QUERY_CACHE_MAX_AGE + 1);
    expect(restored).toBe(false);
    expect(queryClient.getQueryData(workflowsOptions.queryKey)).toBeUndefined();
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it("is gone after a logout clears it, so the next sign-in starts clean", async () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    await firstVisit(storage);

    clearQueryCacheSnapshot(storage);

    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(restoreQueryCache(client(), storage)).toBe(false);
  });

  it("does nothing when there is no snapshot at all (the very first visit)", () => {
    const storage = fakeStorage();
    expect(restoreQueryCache(client(), storage)).toBe(false);
  });
});
