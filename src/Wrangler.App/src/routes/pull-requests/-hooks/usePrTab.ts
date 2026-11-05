import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import type { PullRequestScope } from "./usePullRequests";

/** The pull request tab you were last on, so the page reopens on it. */
export const usePrTab = () => useLocalStorage<PullRequestScope>("prTab", "all");
