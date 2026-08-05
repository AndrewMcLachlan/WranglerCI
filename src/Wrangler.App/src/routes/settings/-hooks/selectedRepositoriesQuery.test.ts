import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import {
  REPOSITORIES_KEY,
  SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  selectedRepositoriesQueryOptions,
  type SelectedRepository,
  type StorageLike,
} from "./repositoryFeatures";

/**
 * Exercises the real react-query runtime, not just our option builder, to pin the
 * behaviour the fix depends on: initialData is stamped with dataUpdatedAt = now,
 * so under a non-zero staleTime the queryFn never runs to replace it.
 *
 * These use the same global staleTime as main.tsx. If that default is ever raised
 * or lowered, or react-query changes how it ages initialData, these fail loudly
 * rather than silently re-emptying every page.
 */

const APP_STALE_TIME = 5 * 60 * 1000;

const stored: SelectedRepository[] = [
  { owner: "acme", name: "widget", workflows: [1], pullRequests: true, securityAlerts: true },
];

const makeStorage = (initial: Record<string, string> = {}): StorageLike => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
};

const populatedStorage = () => makeStorage({
  [REPOSITORIES_KEY]: JSON.stringify(stored),
  [SCHEMA_VERSION_KEY]: SCHEMA_VERSION,
});

/** A fresh client with an empty cache — the state after a hard refresh. */
const newClient = () => new QueryClient({
  defaultOptions: { queries: { staleTime: APP_STALE_TIME, refetchOnWindowFocus: false } },
});

const observe = async <T,>(client: QueryClient, options: object): Promise<QueryObserverResult<T>> => {
  const observer = new QueryObserver<T>(client, options as never);
  const unsubscribe = observer.subscribe(() => { });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = observer.getCurrentResult();
  unsubscribe();
  return result;
};

describe("initialData under the app's staleTime", () => {
  it("serves a placeholder initialData forever, never calling queryFn (the regression)", async () => {
    const queryFn = vi.fn(() => stored);

    const result = await observe<SelectedRepository[]>(newClient(), {
      queryKey: ["selectedRepositories", stored],
      queryFn,
      initialData: [],
    });

    // The placeholder is treated as freshly-fetched data, so nothing replaces it.
    expect(queryFn).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.isStale).toBe(false);
  });

  it("serves the stored value when initialData is the stored value (the fix)", async () => {
    const result = await observe<SelectedRepository[]>(
      newClient(),
      selectedRepositoriesQueryOptions(populatedStorage()),
    );

    expect(result.data).toEqual(stored);
  });

  it("still serves the stored value on a cold cache, as after a hard refresh", async () => {
    // A hard refresh clears the in-memory cache, which is exactly when initialData
    // is applied — so clearing the cache re-arms the bug rather than recovering
    // from it. The fix has to hold on a cold client, not just a warm one.
    for (let reload = 0; reload < 3; reload++) {
      const result = await observe<SelectedRepository[]>(
        newClient(),
        selectedRepositoriesQueryOptions(populatedStorage()),
      );
      expect(result.data).toEqual(stored);
    }
  });

  it("would have worked under staleTime 0, which is why this went unnoticed", async () => {
    const queryFn = vi.fn(() => stored);
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 0 } } });

    const result = await observe<SelectedRepository[]>(client, {
      queryKey: ["selectedRepositories", stored],
      queryFn,
      initialData: [],
    });

    expect(queryFn).toHaveBeenCalled();
    expect(result.data).toEqual(stored);
  });
});
