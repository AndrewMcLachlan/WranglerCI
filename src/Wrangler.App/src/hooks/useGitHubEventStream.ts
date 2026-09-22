import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mergeWorkflowRun, branchMatch, describeMergeMiss } from "./mergeWorkflowRun";
import { mergePullRequest, removePullRequest, isSamePullRequest, type PushedPullRequest } from "./mergePullRequest";
import { createReconnectTracker, createStreamWatchdog, silenceTimeoutFor, STREAM_BACKED_QUERY_KEYS } from "./streamReconnect";
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
  const [connection, setConnection] = useState(0);
  // A ref, not state: resetting this must not re-run the effect, or proving the
  // stream healthy would tear down the very connection that proved it.
  const silentRebuildsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const checkStatusTimers = new Map<string, ReturnType<typeof setTimeout>>();

    // A connection that dies without erroring still reports OPEN, so silence is
    // the only evidence. Rebuilding is what recovers it: the reopened stream
    // resyncs the caches through the reconnect tracker below.
    const watchdog = createStreamWatchdog(() => {
      silentRebuildsRef.current += 1;
      source.close();
      setConnection((generation) => generation + 1);
    }, silenceTimeoutFor(silentRebuildsRef.current));

    const recordActivity = () => {
      silentRebuildsRef.current = 0;
      watchdog.recordActivity();
    };

    // Merges the pushed run into every cached getWorkflows variant (one per
    // branch-filter combination) and, if present, the drill-down
    // getWorkflowRuns cache for that specific workflow. No refetch.
    const handleWorkflowRun = (evt: GitHubEvent) => {
      const run = evt.run;
      if (!run) {
        // The delivery carries the run itself; without it there is nothing to
        // merge and the dashboard waits for a poll instead.
        console.debug(`workflow_run for ${evt.owner}/${evt.repo} arrived with no run payload.`);
        return;
      }

      let merged = false;
      for (const query of queryClient.getQueryCache().findAll({ queryKey: ["getWorkflows"] })) {
        queryClient.setQueryData<RepositoryModel[]>(query.queryKey, (data) => {
          if (!data) return data;
          const next = mergeWorkflowRun(data, evt.owner, evt.repo, run);
          merged ||= next !== data;
          return next;
        });
      }

      // A push that matches nothing is dropped on purpose — a branch outside
      // this view, say — but it is also what a broken match looks like, and
      // silence makes the two indistinguishable.
      if (!merged) {
        const reasons = queryClient.getQueryCache().findAll({ queryKey: ["getWorkflows"] })
          .map((query) => describeMergeMiss((query.state.data as RepositoryModel[]) ?? [], evt.owner, evt.repo, run))
          .filter((reason): reason is string => reason !== undefined);
        console.debug(
          `workflow_run for ${evt.owner}/${evt.repo} (workflow ${run.workflowId}, branch ${run.headBranch}) changed nothing: ${reasons.join("; ") || "no cached dashboard data"}`);
      }

      for (const query of queryClient.getQueryCache().findAll({ queryKey: ["getWorkflowRuns", evt.owner, evt.repo] })) {
        // Ids come through as number or string depending on the path; compare
        // them as text so a type difference cannot drop the update.
        const workflowId = query.queryKey[3] as number | string | undefined;
        if (String(workflowId) !== String(run.workflowId)) continue;
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
          return Array.isArray(data) && data.some((pr) => isSamePullRequest(pr, pushed));
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
      recordActivity();

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

    // The stream carries no `id:` field and the broadcaster keeps no buffer, so
    // there is no Last-Event-ID replay: anything delivered while the connection
    // was down is lost for good. EventSource reconnects silently, so without this
    // the gap would leave the caches stale indefinitely — which is what makes the
    // long staleTimes on the stream-backed queries safe.
    const reconnect = createReconnectTracker(connection > 0);

    source.onerror = () => reconnect.onError();
    source.onopen = () => {
      // Restarts the countdown but does not clear the backoff: a proxy can
      // accept the connection and still swallow every byte of the body, and
      // only delivered data proves otherwise.
      watchdog.recordActivity();
      if (!reconnect.onOpen()) return;
      for (const queryKey of STREAM_BACKED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    for (const type of ["workflow_run", "check_run", "check_suite", "pull_request"]) {
      source.addEventListener(type, handle);
    }

    // The server's heartbeat is the only traffic on an idle stream, so it is
    // what proves the connection is still alive.
    source.addEventListener("heartbeat", recordActivity);

    return () => {
      watchdog.stop();
      source.removeEventListener("heartbeat", recordActivity);
      source.close();
      for (const timer of checkStatusTimers.values()) clearTimeout(timer);
      checkStatusTimers.clear();
    };
  }, [enabled, queryClient, connection]);
};
