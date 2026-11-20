import type { MergeBlocker, PullRequestModel } from "../api";

// The metadata a pull_request webhook delivery carries, mirroring the backend's
// PullRequestEventData record (camelCase over the wire). Deliberately narrower
// than PullRequestModel: the webhook payload has no aggregate check status,
// merge blockers, or labels, so those fields are never touched by a merge.
export interface PushedPullRequest {
  id: number;
  number: number;
  nodeId: string;
  title: string;
  author: string;
  repositoryOwner: string;
  repositoryName: string;
  htmlUrl: string;
  headSha: string;
  headRef: string;
  createdAt: string;
  updatedAt: string;
  state: string;
  draft: boolean;
  autoMerge: boolean;
}

// Identity match between a cached PR and a pushed webhook PR. Matches by id first,
// falling back to number + repository (owner/name) because PullRequestModel's
// id/number are typed `number | string` while the webhook always sends numbers.
// Shared by the merge/remove helpers and the stream hook's "is it cached?" check
// so the three don't drift apart.
export const isSamePullRequest = (pr: PullRequestModel, pushed: PushedPullRequest): boolean =>
  String(pr.id) === String(pushed.id)
  || (String(pr.number) === String(pushed.number)
    && pr.repositoryOwner.toLowerCase() === pushed.repositoryOwner.toLowerCase()
    && pr.repositoryName.toLowerCase() === pushed.repositoryName.toLowerCase());

// Pure merge of a pushed pull_request webhook event into the cached PR list,
// so the PR table can reflect a live SSE update without a GitHub refetch.
// Matches the cached PR by id first, falling back to number + repository
// (owner/name) since PullRequestModel's id/number are typed `number | string`
// while the webhook always sends numbers. checkStatus (and blockers, labels)
// are never in the pull_request webhook payload — that status only comes from
// check_run/check_suite events — so those fields are always left untouched.
// A PR that isn't already cached is ignored (no insert): inserting would need
// checkStatus/blockers/labels that only the GitHub API fetch computes.
export const mergePullRequest = (
  prs: PullRequestModel[],
  pushed: PushedPullRequest,
): PullRequestModel[] => {
  const index = prs.findIndex((pr) => isSamePullRequest(pr, pushed));

  if (index === -1) return prs;

  const updated: PullRequestModel = {
    ...prs[index],
    number: pushed.number,
    nodeId: pushed.nodeId,
    title: pushed.title,
    author: pushed.author,
    repositoryOwner: pushed.repositoryOwner,
    repositoryName: pushed.repositoryName,
    htmlUrl: pushed.htmlUrl,
    headSha: pushed.headSha,
    headRef: pushed.headRef,
    updatedAt: pushed.updatedAt,
    blockers: withDraft(prs[index].blockers ?? [], pushed.draft),
    autoMerge: pushed.autoMerge,
  };

  return prs.map((pr, i) => (i === index ? updated : pr));
};

// The delivery is the truth on draft: a refetch straight after it can still read the PR as it was.
const withDraft = (blockers: MergeBlocker[], draft: boolean): MergeBlocker[] => {
  if (draft === blockers.includes("Draft")) return blockers;
  return draft ? ["Draft", ...blockers] : blockers.filter((b) => b !== "Draft");
};

// Pure removal of a pushed pull_request from the cached PR list. The PR list is
// open-only (the server filters ItemStateFilter.Open), so when a delivery reports
// a non-open state (merged/closed) the PR must leave the list rather than linger
// with a stale check badge. Matches the same id / number+repository identity as
// mergePullRequest. Returns the input unchanged (same reference) when the PR
// isn't cached, so callers can skip a needless cache write.
export const removePullRequest = (
  prs: PullRequestModel[],
  pushed: PushedPullRequest,
): PullRequestModel[] => {
  const index = prs.findIndex((pr) => isSamePullRequest(pr, pushed));

  if (index === -1) return prs;

  return prs.filter((_, i) => i !== index);
};
