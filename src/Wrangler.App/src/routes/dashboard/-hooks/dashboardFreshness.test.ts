import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import { QUERY_DEFAULTS } from "../../../queryDefaults";
import { DASHBOARD_STALE_TIME } from "./dashboardFreshness";

/**
 * The requirement these protect: landing on the dashboard shows current data.
 * The stream keeps the cache live while the page is open, but it carries only
 * workflow_run deliveries and only for repos whose webhooks are wired, so
 * arriving at the page must also refetch. Flipping between the three views is
 * not an arrival.
 */

const client = () => new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });

const dashboardQuery = (queryFn: () => Promise<string[]>) => ({
  queryKey: ["getWorkflows", [{ owner: "acme", name: "site" }], []],
  queryFn,
  staleTime: DASHBOARD_STALE_TIME,
});

/** Mounting one of the dashboard views. */
const land = (queryClient: QueryClient, queryFn: () => Promise<string[]>) => {
  const observer = new QueryObserver<string[]>(queryClient, dashboardQuery(queryFn) as never);
  const unsubscribe = observer.subscribe(() => { });
  return { observer, leave: unsubscribe };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("landing on the dashboard", () => {
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

  it("does not refetch when flipping between the three views", async () => {
    vi.useFakeTimers();
    const queryFn = vi.fn(async () => ["run:green"]);
    const queryClient = client();

    const overview = land(queryClient, queryFn);
    await vi.advanceTimersByTimeAsync(0);
    overview.leave();

    // Overview -> nested -> list, as fast as the router can swap them.
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

    await vi.advanceTimersByTimeAsync(DASHBOARD_STALE_TIME + 1);
    const second = land(queryClient, queryFn);

    expect(queryFn).toHaveBeenCalledTimes(2);
    second.leave();
  });

  it("keeps the guard window short enough to feel like a fresh page", () => {
    // Anything approaching the old 10 minute staleTime reintroduces the stale
    // landing this exists to fix.
    expect(DASHBOARD_STALE_TIME).toBeLessThanOrEqual(60 * 1000);
  });
});
