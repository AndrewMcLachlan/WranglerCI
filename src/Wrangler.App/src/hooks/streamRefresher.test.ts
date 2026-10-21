import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { QUERY_DEFAULTS } from "../queryDefaults";
import { createStreamRefresher, offPageRefetchDelayMs, onPageRefetchDelayMs } from "./streamRefresher";

const currentKey = ["pullRequests", "current"];
const oldKey = ["pullRequests", "old-authors"];

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });
  const fetches: string[] = [];
  const seed = (key: string[], at: number) => {
    vi.setSystemTime(at);
    client.setQueryData(key, []);
    client.getQueryCache().find({ queryKey: key })!.setOptions({
      queryKey: key,
      queryFn: async () => { fetches.push(key[1]); return []; },
    });
  };
  seed(oldKey, 1000);
  seed(currentKey, 2000);
  vi.setSystemTime(3000);
  return { client, fetches, refresher: createStreamRefresher(client, ["pullRequests"]) };
};

/** What the page does while it is mounted. */
const openPage = (client: QueryClient, fetches: string[]) => {
  const observer = new QueryObserver(client, { queryKey: currentKey, queryFn: async () => { fetches.push("current"); return []; }, staleTime: Infinity });
  return observer.subscribe(() => { });
};

describe("createStreamRefresher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refetches the list shortly after an event while the page is open", async () => {
    const { client, fetches, refresher } = setup();
    const close = openPage(client, fetches);

    refresher.schedule();
    await vi.advanceTimersByTimeAsync(onPageRefetchDelayMs);

    expect(fetches).toEqual(["current"]);
    close();
  });

  it("waits longer off the page, and refetches only the list last looked at", async () => {
    const { fetches, refresher } = setup();

    refresher.schedule();
    await vi.advanceTimersByTimeAsync(onPageRefetchDelayMs);
    expect(fetches).toEqual([]);

    await vi.advanceTimersByTimeAsync(offPageRefetchDelayMs - onPageRefetchDelayMs);
    expect(fetches).toEqual(["current"]);
  });

  it("marks the list stale at once off the page, so arriving refetches", () => {
    const { client, refresher } = setup();

    refresher.schedule();

    expect(client.getQueryCache().find({ queryKey: currentKey })!.isStale()).toBe(true);
  });

  it("collapses a burst into one refetch that a steady stream cannot postpone", async () => {
    const { client, fetches, refresher } = setup();
    const close = openPage(client, fetches);

    for (let i = 0; i < 5; i++) {
      refresher.schedule();
      await vi.advanceTimersByTimeAsync(onPageRefetchDelayMs / 4);
    }

    expect(fetches).toEqual(["current"]);
    close();
  });

  it("brings a pending off-page refetch forward when an event arrives on the page", async () => {
    const { client, fetches, refresher } = setup();

    refresher.schedule();
    const close = openPage(client, fetches);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetches).toEqual(["current"]);

    refresher.schedule();
    await vi.advanceTimersByTimeAsync(onPageRefetchDelayMs);
    expect(fetches).toEqual(["current", "current"]);

    await vi.advanceTimersByTimeAsync(offPageRefetchDelayMs);
    expect(fetches).toEqual(["current", "current"]);
    close();
  });

  it("fires nothing once disposed", async () => {
    const { fetches, refresher } = setup();

    refresher.schedule();
    refresher.dispose();
    await vi.advanceTimersByTimeAsync(offPageRefetchDelayMs);

    expect(fetches).toEqual([]);
  });
});
