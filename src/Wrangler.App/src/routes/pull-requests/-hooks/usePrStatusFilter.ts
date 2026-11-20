import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import type { CheckStatus } from "../../../api";
import type { PullRequestScope } from "./usePullRequests";
import { prFilterKey } from "./prFilterKey";

/**
 * The set of check statuses to include in the visible pull-request list on a tab.
 * An empty array means "show everything" (the default).
 */
export const usePrStatusFilter = (scope: PullRequestScope) =>
  useLocalStorage<CheckStatus[]>(prFilterKey("prStatusFilter", scope), []);
