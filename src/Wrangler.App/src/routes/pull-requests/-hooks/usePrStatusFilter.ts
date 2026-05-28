import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import type { CheckStatus } from "../../../api";

/**
 * The set of check statuses to include in the visible pull-request list.
 * An empty array means "show everything" (the default).
 */
export const usePrStatusFilter = () =>
  useLocalStorage<CheckStatus[]>("prStatusFilter", []);
