import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mergeWorkflowRun, branchMatch } from "./mergeWorkflowRun";
import { mergePullRequest, removePullRequest, isSamePullRequest, type PushedPullRequest } from "./mergePullRequest";
import { withoutGatesForRun } from "./gateStatus";
import { createStreamRefresher } from "./streamRefresher";
import { createReconnectTracker, createStreamWatchdog, silenceTimeoutFor, STREAM_BACKED_QUERY_KEYS } from "./streamReconnect";
import type { DeploymentGateModel, PullRequestModel, RepositoryModel, WorkflowRunModel } from "../api";

interface GitHubEvent {
  type: string;
  action?: string;
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

export const useGitHubEventStream = (enabled: boolean = true) => {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState(0);
  // A ref, not state: resetting this must not re-run the effect, or proving the
  // stream healthy would tear down the very connection that proved it.
  const silentRebuildsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource("/api/events/stream", { withCredentials: true });
    const pullRequests = createStreamRefresher(queryClient, ["pullRequests"]);
    const gates = createStreamRefresher(queryClient, ["gates"]);

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
      if (!run) return;

      for (const query of queryClient.getQueryCache().findAll({ queryKey: ["getWorkflows"] })) {
        queryClient.setQueryData<RepositoryModel[]>(query.queryKey, (data) =>
          data ? mergeWorkflowRun(data, evt.owner, evt.repo, run) : data);
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

      if (run.status === "completed") {
        queryClient.setQueriesData<DeploymentGateModel[]>({ queryKey: ["gates"] }, (data) =>
          data ? withoutGatesForRun(data, run.id) : data);
      }
    };

    // Reconciles a pull_request delivery against the open-only PR list caches.
    // The list only ever holds open PRs (server filters ItemStateFilter.Open):
    //  - non-open (merged/closed) -> remove it from every cached variant so it
    //    doesn't linger with a stale check badge;
    //  - open -> merge the metadata if cached, and schedule a list refetch for
    //    what the delivery can't carry (and for a PR the caches don't know yet).
    const handlePullRequest = (evt: GitHubEvent) => {
      const pushed = evt.pullRequest;
      if (!pushed) return;

      if (pushed.state !== "open") {
        queryClient.setQueriesData<PullRequestModel[]>({ queryKey: ["pullRequests"] }, (data) =>
          data ? removePullRequest(data, pushed) : data);
        return;
      }

      // The merge below shows the metadata at once; checks, conflicts and labels need the refetch.
      pullRequests.schedule();

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
      }
    };

    // A run pausing at a gate sends no workflow_run, so a requested review is
    // the only news of a new gate.
    const handleDeploymentReview = (evt: GitHubEvent) => {
      if (evt.action === "requested") {
        gates.schedule();
        return;
      }
      if (evt.runId === undefined) return;
      const runId = evt.runId;
      queryClient.setQueriesData<DeploymentGateModel[]>({ queryKey: ["gates"] }, (data) =>
        data ? withoutGatesForRun(data, runId) : data);
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
        case "pull_request_review":
          pullRequests.schedule();
          break;
        case "deployment_review":
          handleDeploymentReview(parsed);
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

    for (const type of ["workflow_run", "check_run", "check_suite", "pull_request", "pull_request_review", "deployment_review"]) {
      source.addEventListener(type, handle);
    }

    // The server's heartbeat is the only traffic on an idle stream, so it is
    // what proves the connection is still alive.
    source.addEventListener("heartbeat", recordActivity);

    return () => {
      watchdog.stop();
      source.removeEventListener("heartbeat", recordActivity);
      source.close();
      pullRequests.dispose();
      gates.dispose();
    };
  }, [enabled, queryClient, connection]);
};
