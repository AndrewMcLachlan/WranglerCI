import type { QueryClient } from "@tanstack/react-query";

const queryKey = ["pullRequests"];

/** How soon the list refetches after an event while it is on screen. */
export const onPageRefetchDelayMs = 2000;

/** How soon it refetches while you are elsewhere: arriving refetches anyway, so this only keeps it warm. */
export const offPageRefetchDelayMs = 30_000;

/**
 * Turns stream events into pull request list refetches. No event carries the
 * aggregate check status or mergeability, so only a refetch shows them.
 *
 * A burst of events costs one refetch, which fires a fixed delay after the
 * first event rather than after the last, so a busy repo cannot hold it off.
 */
export const createPullRequestRefresher = (queryClient: QueryClient) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dueAt = 0;

  const isOnPage = () => queryClient.getQueryCache().findAll({ queryKey, type: "active" }).length > 0;

  const refetch = () => {
    timer = undefined;
    const queries = queryClient.getQueryCache().findAll({ queryKey });
    const active = queries.filter((q) => q.isActive());
    // Off the page, only the list you last looked at: the others are old author filters.
    const targets = active.length > 0
      ? active
      : [...queries].sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt).slice(0, 1);

    for (const query of targets) {
      queryClient.refetchQueries({ queryKey: query.queryKey, exact: true });
    }
  };

  return {
    schedule() {
      const onPage = isOnPage();
      // Must mark the list stale now: arriving before the timer fires would otherwise show it as current.
      if (!onPage) queryClient.invalidateQueries({ queryKey, refetchType: "none" });

      const delay = onPage ? onPageRefetchDelayMs : offPageRefetchDelayMs;
      const now = Date.now();
      if (timer !== undefined && dueAt <= now + delay) return;

      clearTimeout(timer);
      dueAt = now + delay;
      timer = setTimeout(refetch, delay);
    },
    dispose() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
};
