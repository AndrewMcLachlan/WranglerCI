import type { QueryClientConfig } from "@tanstack/react-query";

/**
 * Cache defaults for the app's QueryClient, exported so the behaviour they
 * encode can be asserted in tests rather than silently drifting.
 */
export const QUERY_DEFAULTS: NonNullable<QueryClientConfig["defaultOptions"]>["queries"] = {
  // The SSE stream (useGitHubEventStream) pushes workflow and PR updates straight
  // into the caches, so react-query's staleTime: 0 default — which refetches on
  // every mount, and therefore every page switch — spends GitHub quota
  // re-fetching data the stream already keeps current.
  staleTime: 5 * 60 * 1000,

  // Well beyond a page-to-page detour, because react-query's 5 minute default
  // evicts an inactive query surprisingly fast. Two things break when the entry
  // is evicted: coming back shows a spinner and refetches from GitHub even though
  // the stream was live the whole time, and — worse — the stream's
  // getQueryCache().findAll() matches nothing while the entry is gone, so every
  // event for a page you are not currently looking at is silently dropped.
  // Retaining the entry lets those pushes land, so returning to a tab left open
  // for hours shows current data rather than a reload.
  gcTime: 24 * 60 * 60 * 1000,

  // Data is kept current by the stream, so a focus refetch is redundant cost.
  refetchOnWindowFocus: false,
};
