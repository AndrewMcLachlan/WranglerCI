import type { QueryClientConfig } from "@tanstack/react-query";

/** The API reports GitHub's rate limit as a 429 problem-details body. */
export const isRateLimited = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { status?: unknown }).status === 429;

/** Cache defaults for the app's QueryClient. Exported so tests can assert them. */
export const QUERY_DEFAULTS: NonNullable<QueryClientConfig["defaultOptions"]>["queries"] = {
  // The SSE stream (useGitHubEventStream) pushes workflow and PR updates
  // straight into the caches, so a refetch on every mount spends GitHub quota
  // on data that is already current.
  staleTime: 5 * 60 * 1000,

  // Long enough that an inactive query survives a detour to another page.
  // While an entry is evicted the stream's getQueryCache().findAll() matches
  // nothing, so every event for that page is silently dropped.
  gcTime: 24 * 60 * 60 * 1000,

  // Data is kept current by the stream, so a focus refetch is redundant cost.
  refetchOnWindowFocus: false,

  // Retrying a rate-limited call only spends the quota as soon as it returns.
  retry: (failureCount, error) => !isRateLimited(error) && failureCount < 3,
};
