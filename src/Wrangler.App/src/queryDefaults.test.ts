import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import { QUERY_DEFAULTS } from "./queryDefaults";

/**
 * The scenario these protect: Wrangler left open in a tab for hours, revisited
 * every so often. react-query evicts an inactive query after gcTime, and its
 * default gcTime is only 5 minutes — shorter than a trip to another page. Once
 * the entry is evicted the stream's getQueryCache().findAll() matches nothing, so
 * pushes for that page are dropped and returning shows a spinner plus a full
 * refetch. None of that is visible in a unit test of the merge helpers, so it is
 * pinned here against the real react-query runtime.
 */

const REACT_QUERY_DEFAULT_GC_TIME = 5 * 60 * 1000;

const client = () => new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });

const workflowsOptions = {
  queryKey: ["getWorkflows"],
  queryFn: async () => ["run:green"],
};

/** Mounting a page that observes the query; unsubscribe = navigating away. */
const mount = (queryClient: QueryClient) => {
  const observer = new QueryObserver<string[]>(queryClient, workflowsOptions as never);
  const unsubscribe = observer.subscribe(() => { });
  return { observer, unsubscribe };
};

/** How useGitHubEventStream applies a pushed workflow_run. */
const pushStreamEvent = (queryClient: QueryClient) => {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["getWorkflows"] })) {
    queryClient.setQueryData<string[]>(query.queryKey, (data) =>
      data ? [...data, "run:red(pushed)"] : data);
  }
};

afterEach(() => {
  vi.useRealTimers();
});

describe("QUERY_DEFAULTS", () => {
  it("retains inactive queries for far longer than react-query's default", () => {
    // The value itself matters: anything near the 5 minute default reintroduces
    // the eviction this guards against.
    expect(QUERY_DEFAULTS?.gcTime).toBeGreaterThan(REACT_QUERY_DEFAULT_GC_TIME * 12);
  });

  it("does not refetch on window focus", () => {
    expect(QUERY_DEFAULTS?.refetchOnWindowFocus).toBe(false);
  });
});

describe("a detour longer than react-query's default gcTime", () => {
  it("keeps the cache entry, so a stream push still lands and the page shows it", async () => {
    vi.useFakeTimers();
    const queryClient = client();

    const visit = mount(queryClient);
    await vi.advanceTimersByTimeAsync(0);
    expect(queryClient.getQueryData(["getWorkflows"])).toEqual(["run:green"]);

    // Navigate to another page and stay there past the old default gcTime.
    visit.unsubscribe();
    await vi.advanceTimersByTimeAsync(REACT_QUERY_DEFAULT_GC_TIME + 60_000);

    // The entry survives, so the stream can still find it...
    expect(queryClient.getQueryCache().findAll({ queryKey: ["getWorkflows"] })).toHaveLength(1);
    pushStreamEvent(queryClient);
    expect(queryClient.getQueryData(["getWorkflows"])).toEqual(["run:green", "run:red(pushed)"]);

    // ...and coming back renders the pushed data with no spinner.
    const back = mount(queryClient);
    const result: QueryObserverResult<string[]> = back.observer.getCurrentResult();
    expect(result.isLoading).toBe(false);
    expect(result.data).toEqual(["run:green", "run:red(pushed)"]);
    back.unsubscribe();
  });

  it("would have evicted the entry and dropped the push under the old default", async () => {
    vi.useFakeTimers();
    // Same journey, but with react-query's default gcTime — the behaviour being
    // fixed, kept here so the contrast stays honest if the default ever changes.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { ...QUERY_DEFAULTS, gcTime: REACT_QUERY_DEFAULT_GC_TIME } },
    });

    const visit = mount(queryClient);
    await vi.advanceTimersByTimeAsync(0);
    visit.unsubscribe();
    await vi.advanceTimersByTimeAsync(REACT_QUERY_DEFAULT_GC_TIME + 60_000);

    expect(queryClient.getQueryCache().findAll({ queryKey: ["getWorkflows"] })).toHaveLength(0);
    pushStreamEvent(queryClient);
    expect(queryClient.getQueryData(["getWorkflows"])).toBeUndefined();
  });
});
