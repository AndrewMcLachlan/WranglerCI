import type { MergeBlocker, PullRequestModel } from "../../../api";

export type PrState = "ready" | "waiting" | "fix" | "draft";

const authorMustFix: MergeBlocker[] = ["Conflict", "Behind", "ChangesRequested"];

export const canMerge = (pr: PullRequestModel) => pr.checkStatus === "Success" && (pr.blockers ?? []).length === 0;

/** Who the pull request is waiting on: nobody (ready), someone else (waiting), its author (fix), or it's still a draft. */
export const prState = (pr: PullRequestModel): PrState => {
  const blockers = pr.blockers ?? [];
  if (blockers.includes("Draft")) return "draft";
  if (pr.checkStatus === "Failure" || blockers.some((b) => authorMustFix.includes(b))) return "fix";
  if (canMerge(pr)) return "ready";
  return "waiting";
};
