import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mergeWorkflowRun, branchMatch } from "./mergeWorkflowRun";
import { mergePullRequest, removePullRequest, type PushedPullRequest } from "./mergePullRequest";
import type { PullRequestModel, RepositoryModel, WorkflowRunModel } from "../api";

interface GitHubEvent {
  type: string;
  owner: string;
  repo: string;
  workflowId?: number;
  runId?: number;
  pullRequestNumber?: number;
  deliveryId?: string;
  // Present on workflow_run deliveries — the full run, pushed straight into
  // the dashboard caches (see handleWorkflowRun) instead of triggering a
  // GitHub refetch.
  run?: WorkflowRunModel;
  // Present on pull_request deliveries — PR metadata only; checks aren't part
  // of this webhook (see mergePullRequest).
  pullRequest?: PushedPullRequest;
}

// check_run/check_suite deliveries can't carry the PR's aggregate check
// status (only the GitHub API fetch computes that), so they fall back to a
// refetch of the PR list. Debounced per owner/repo so a burst of per-check
// deliveries for the same repo collapses into a single refetch.
const CHECK_STATUS_DEBOUNCE_MS = 2000;

export const useGitHubEventStream = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const checkStatusTimers = new Map<string, ReturnType<typeof setTimeout>>();

    // Merges the pushed run into every cached getWorkflows variant (one per
    // branch-filter combination) and, if present, the drill-down
    // getWorkflowRuns cache for that specific workflow. No refetch.
    const handleWorkflowRun = (evt: GitHubEvent) => {
      const run = evt.run;
      if (!run) return;

      for (const query of queryClient.getQueryCache().findAll({ queryKey: ["getWorkflows"] })) {
        queryClient.setQueryData<RepositoryModel[]>(query.queryKey, (data) =>
          data ? mergeWorkflowRun(data, evt.owner, evt.repo, run) : data);
      }

      for (const query of queryClient.getQueryCache().findAll({ queryKey: ["getWorkflowRuns", evt.owner, evt.repo] })) {
        const workflowId = query.queryKey[3];
        if (workflowId !== run.workflowId) continue;
        const branchFilter = (query.queryKey[4] as string[] | undefined) ?? [];
        if (!branchMatch(run.headBranch, branchFilter)) continue;

        queryClient.setQueryData<WorkflowRunModel[]>(query.queryKey, (data) => {
          if (!Array.isArray(data)) return data;
          const existingIndex = data.findIndex((r) => r.id === run.id);
          if (existingIndex !== -1) return data.map((r, i) => (i === existingIndex ? run : r));
          return [run, ...data];
        });
      }
    };

    // Reconciles a pull_request delivery against the open-only PR list caches.
    // The list only ever holds open PRs (server filters ItemStateFilter.Open):
    //  - non-open (merged/closed) -> remove it from every cached variant so it
    //    doesn't linger with a stale check badge;
    //  - open + already cached -> merge metadata (checkStatus left untouched);
    //  - open + not cached (newly opened) -> debounced list invalidation so it
    //    appears, reusing the per-repo check-status timer (no per-event refetch).
    const handlePullRequest = (evt: GitHubEvent) => {
      const pushed = evt.pullRequest;
      if (!pushed) return;

      if (pushed.state !== "open") {
        queryClient.setQueriesData<PullRequestModel[]>({ queryKey: ["pullRequests"] }, (data) =>
          data ? removePullRequest(data, pushed) : data);
        return;
      }

      const isCached = queryClient
        .getQueryCache()
        .findAll({ queryKey: ["pullRequests"] })
        .some((query) => {
          const data = query.state.data as PullRequestModel[] | undefined;
          return Array.isArray(data) && data.some((pr) =>
            String(pr.id) === String(pushed.id)
            || (String(pr.number) === String(pushed.number)
              && pr.repositoryOwner.toLowerCase() === pushed.repositoryOwner.toLowerCase()
              && pr.repositoryName.toLowerCase() === pushed.repositoryName.toLowerCase()));
        });

      if (isCached) {
        queryClient.setQueriesData<PullRequestModel[]>({ queryKey: ["pullRequests"] }, (data) =>
          data ? mergePullRequest(data, pushed) : data);
        return;
      }

      // Newly opened PR the caches don't yet know about: fall back to a debounced
      // list refetch so the aggregate checkStatus/mergeable/labels are computed.
      scheduleCheckStatusRefetch(evt);
    };

    const scheduleCheckStatusRefetch = (evt: GitHubEvent) => {
      const key = `${evt.owner}/${evt.repo}`;
      const existing = checkStatusTimers.get(key);
      if (existing) clearTimeout(existing);

      checkStatusTimers.set(key, setTimeout(() => {
        checkStatusTimers.delete(key);
        queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
      }, CHECK_STATUS_DEBOUNCE_MS));
    };

    const handle = (rawEvent: MessageEvent) => {
      let parsed: GitHubEvent;
      try {
        parsed = JSON.parse(rawEvent.data);
      } catch {
        return;
      }

      switch (parsed.type) {
        case "workflow_run":
          handleWorkflowRun(parsed);
          break;
        case "pull_request":
          handlePullRequest(parsed);
          break;
        case "check_run":
        case "check_suite":
          scheduleCheckStatusRefetch(parsed);
          break;
      }
    };

    for (const type of ["workflow_run", "check_run", "check_suite", "pull_request"]) {
      source.addEventListener(type, handle);
    }

    return () => {
      source.close();
      for (const timer of checkStatusTimers.values()) clearTimeout(timer);
      checkStatusTimers.clear();
    };
  }, [enabled, queryClient]);
};
