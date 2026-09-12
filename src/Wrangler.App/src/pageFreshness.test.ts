import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import { QUERY_DEFAULTS } from "./queryDefaults";
import { PAGE_STALE_TIME } from "./pageFreshness";

/**
 * The requirement these protect: landing on a list page shows current data.
 * The stream keeps the workflow and pull request caches live while a page is
 * open, but it carries no gate events at all and only reaches repos whose
 * webhooks are wired, so arriving at a page must also refetch.
 *
 * The dashboard is the worked example; the same staleTime drives pull requests
 * and gates.
 */

const client = () => new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });

const listQuery = (queryFn: () => Promise<string[]>) => ({
  queryKey: ["getWorkflows", [{ owner: "acme", name: "site" }], []],
  queryFn,
  staleTime: PAGE_STALE_TIME,
});

/** Mounting a page that reads the list. */
const land = (queryClient: QueryClient, queryFn: () => Promise<string[]>) => {
  const observer = new QueryObserver<string[]>(queryClient, listQuery(queryFn) as never);
  const unsubscribe = observer.subscribe(() => { });
  return { observer, leave: unsubscribe };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("landing on a list page", () => {
  it("refetches in the background, with the previous data still on screen", async () => {
    vi.useFakeTimers();
    const queryFn = vi.fn(async () => ["run:green"]);
    const queryClient = client();

    const first = land(queryClient, queryFn);
    await vi.advanceTimersByTimeAsync(0);
    first.leave();

    // Off to another page, back a few minutes later.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const second = land(queryClient, queryFn);

    const onArrival: QueryObserverResult<string[]> = second.observer.getCurrentResult();
    expect(onArrival.data).toEqual(["run:green"]);
    expect(onArrival.isLoading).toBe(false);
    expect(onArrival.isFetching).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(2);
    second.leave();
  });

  it("does not refetch when swapping views of the same data", async () => {
    vi.useFakeTimers();
    const queryFn = vi.fn(async () => ["run:green"]);
    const queryClient = client();

    const overview = land(queryClient, queryFn);
    await vi.advanceTimersByTimeAsync(0);
    overview.leave();

    // The dashboard's overview -> nested -> list, as fast as the router swaps them.
    const nested = land(queryClient, queryFn);
    nested.leave();
    const list = land(queryClient, queryFn);

    expect(queryFn).toHaveBeenCalledTimes(1);
    list.leave();
  });

  it("treats a gap longer than the guard window as an arrival", async () => {
    vi.useFakeTimers();
    const queryFn = vi.fn(async () => ["run:green"]);
    const queryClient = client();

    const first = land(queryClient, queryFn);
    await vi.advanceTimersByTimeAsync(0);
    first.leave();

    await vi.advanceTimersByTimeAsync(PAGE_STALE_TIME + 1);
    const second = land(queryClient, queryFn);

    expect(queryFn).toHaveBeenCalledTimes(2);
    second.leave();
  });

  it("keeps the guard window short enough to feel like a fresh page", () => {
    // Anything approaching the old 10 minute staleTime reintroduces the stale
    // landing this exists to fix.
    expect(PAGE_STALE_TIME).toBeLessThanOrEqual(60 * 1000);
  });
});
