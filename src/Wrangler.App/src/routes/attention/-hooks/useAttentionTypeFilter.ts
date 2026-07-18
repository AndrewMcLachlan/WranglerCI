import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import type { AttentionItemType } from "../../../api";

/**
 * The attention item types to show in the feed. An empty array means "show
 * everything" (the default); otherwise only the selected types are shown — e.g.
 * select "PullRequestReview" for a focused "awaiting my review" cut (issue #146).
 */
export const useAttentionTypeFilter = () =>
  useLocalStorage<AttentionItemType[]>("attentionTypeFilter", []);
