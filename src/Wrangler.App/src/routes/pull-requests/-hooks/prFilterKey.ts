import type { PullRequestScope } from "./usePullRequests";

/** The storage key for a filter on one tab. All must keep the unscoped key, which holds the filters saved before each tab had its own. */
export const prFilterKey = (base: string, scope: PullRequestScope): string =>
  scope === "all" ? base : `${base}.${scope}`;
