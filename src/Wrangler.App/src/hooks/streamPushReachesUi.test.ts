import { describe, it, expect } from "vitest";
import { QueryClient, QueryObserver, keepPreviousData } from "@tanstack/react-query";
import { QUERY_DEFAULTS } from "../queryDefaults";
import { PAGE_STALE_TIME } from "../pageFreshness";
import { mergeWorkflowRun } from "./mergeWorkflowRun";
import { filterByStatus } from "../routes/dashboard/-hooks/useWorkflows";
import type { RepositoryModel, WorkflowRunModel, WorkflowStatus } from "../api";

/**
 * The seam between the stream and the screen: a pushed run is written into the
 * cache by useGitHubEventStream, and the dashboard reads it through
 * useWorkflows' own options. Each half is covered elsewhere; this is the part
 * where a push lands in the cache and the page still shows the old status.
 */

const run = (overrides: Partial<WorkflowRunModel> = {}): WorkflowRunModel => ({
  id: 1,
  workflowId: 10,
  nodeId: "run-node",
  conclusion: "success",
  headBranch: "main",
  event: "push",
  runNumber: 1,
  status: "completed",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  htmlUrl: "https://github.com/acme/widget/actions/runs/1",
  workflowStatus: "Green",
  ...overrides,
});

const repositories = (): RepositoryModel[] => [{
  name: "widget",
  owner: "acme",
  ownerName: "Acme",
  nodeId: "repo-widget",
  htmlUrl: "https://github.com/acme/widget",
  overallStatus: "Green",
  workflows: [{
    id: 10,
    nodeId: "wf-10",
    name: "CI",
    htmlUrl: "",
    overallStatus: "Green",
    runs: [run()],
  }],
}];

const selectedRepositories = [{ owner: "acme", name: "widget", workflows: [10] }];
const queryKey = ["getWorkflows", selectedRepositories, []];

/** The dashboard's own read of the cache: status filtering, previous data kept. */
const mountDashboard = (client: QueryClient, statusFilter: WorkflowStatus[] = []) => {
  const observer = new QueryObserver<RepositoryModel[], Error, RepositoryModel[]>(client, {
    queryKey,
    queryFn: async () => repositories(),
    select: (data: RepositoryModel[]) => filterByStatus(data, statusFilter),
    placeholderData: keepPreviousData,
    staleTime: PAGE_STALE_TIME,
  } as never);
  const unsubscribe = observer.subscribe(() => { });
  return { observer, unsubscribe };
};

/** Exactly what useGitHubEventStream does with a workflow_run delivery. */
const pushRun = (client: QueryClient, pushed: WorkflowRunModel) => {
  for (const query of client.getQueryCache().findAll({ queryKey: ["getWorkflows"] })) {
    client.setQueryData<RepositoryModel[]>(query.queryKey, (data) =>
      data ? mergeWorkflowRun(data, "acme", "widget", pushed) : data);
  }
};

describe("a pushed run reaching the dashboard", () => {
  it("changes what the page is showing", async () => {
    const client = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });
    client.setQueryData(queryKey, repositories());

    const view = mountDashboard(client);
    expect(view.observer.getCurrentResult().data?.[0].workflows?.[0].overallStatus).toBe("Green");

    pushRun(client, run({ workflowStatus: "Red", conclusion: "failure" }));

    const after = view.observer.getCurrentResult();
    expect(after.data?.[0].workflows?.[0].runs?.[0].workflowStatus).toBe("Red");
    expect(after.data?.[0].workflows?.[0].overallStatus).toBe("Red");
    view.unsubscribe();
  });

  it("hands the page a new object, so a memoised row cannot keep the old one", () => {
    const client = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });
    client.setQueryData(queryKey, repositories());

    const view = mountDashboard(client);
    const before = view.observer.getCurrentResult().data;

    pushRun(client, run({ workflowStatus: "Red", conclusion: "failure" }));

    const after = view.observer.getCurrentResult().data;
    expect(after).not.toBe(before);
    expect(after?.[0]).not.toBe(before?.[0]);
    expect(after?.[0].workflows?.[0]).not.toBe(before?.[0].workflows?.[0]);
    view.unsubscribe();
  });

  it("notifies the subscriber", () => {
    const client = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });
    client.setQueryData(queryKey, repositories());

    const observer = new QueryObserver<RepositoryModel[], Error, RepositoryModel[]>(client, {
      queryKey,
      queryFn: async () => repositories(),
      select: (data: RepositoryModel[]) => filterByStatus(data, []),
      placeholderData: keepPreviousData,
      staleTime: PAGE_STALE_TIME,
    } as never);

    let notifications = 0;
    const unsubscribe = observer.subscribe(() => { notifications += 1; });

    pushRun(client, run({ workflowStatus: "Red", conclusion: "failure" }));

    expect(notifications).toBeGreaterThan(0);
    unsubscribe();
  });
});
