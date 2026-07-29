import type { PullRequestModel } from "../api";

// The metadata a pull_request webhook delivery carries, mirroring the backend's
// PullRequestEventData record (camelCase over the wire). Deliberately narrower
// than PullRequestModel: the webhook payload has no aggregate check status,
// mergeable flag, or labels, so those fields are never touched by a merge.
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
}

// Pure merge of a pushed pull_request webhook event into the cached PR list,
// so the PR table can reflect a live SSE update without a GitHub refetch.
// Matches the cached PR by id first, falling back to number + repository
// (owner/name) since PullRequestModel's id/number are typed `number | string`
// while the webhook always sends numbers. checkStatus (and mergeable, labels)
// are never in the pull_request webhook payload — that status only comes from
// check_run/check_suite events — so those fields are always left untouched.
// A PR that isn't already cached is ignored (no insert): inserting would need
// checkStatus/mergeable/labels that only the GitHub API fetch computes.
export const mergePullRequest = (
  prs: PullRequestModel[],
  pushed: PushedPullRequest,
): PullRequestModel[] => {
  const index = prs.findIndex((pr) =>
    String(pr.id) === String(pushed.id)
    || (String(pr.number) === String(pushed.number)
      && pr.repositoryOwner.toLowerCase() === pushed.repositoryOwner.toLowerCase()
      && pr.repositoryName.toLowerCase() === pushed.repositoryName.toLowerCase()));

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
  };

  return prs.map((pr, i) => (i === index ? updated : pr));
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
  const index = prs.findIndex((pr) =>
    String(pr.id) === String(pushed.id)
    || (String(pr.number) === String(pushed.number)
      && pr.repositoryOwner.toLowerCase() === pushed.repositoryOwner.toLowerCase()
      && pr.repositoryName.toLowerCase() === pushed.repositoryName.toLowerCase()));

  if (index === -1) return prs;

  return prs.filter((_, i) => i !== index);
};
