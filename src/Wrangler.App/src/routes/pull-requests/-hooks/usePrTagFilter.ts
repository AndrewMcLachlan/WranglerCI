import { useLocalStorage } from "@andrewmclachlan/moo-ds";

/**
 * The label names to require on visible pull requests (inclusive filter).
 * An empty array means "no include constraint" (the default). Matching is OR:
 * a PR passes if it carries at least one of these labels.
 */
export const usePrIncludeTags = () =>
  useLocalStorage<string[]>("prIncludeTags", []);

/**
 * The label names to hide from the visible pull-request list (exclusive filter).
 * A PR is hidden if it carries any of these labels. Exclude wins over include
 * when the same tag appears in both.
 */
export const usePrExcludeTags = () =>
  useLocalStorage<string[]>("prExcludeTags", []);
