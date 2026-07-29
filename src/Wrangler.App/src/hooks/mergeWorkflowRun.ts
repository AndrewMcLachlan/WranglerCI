import type { RepositoryModel, WorkflowModel, WorkflowRunModel, WorkflowStatus } from "../api";

// Mirrors the branch-match semantics in routes/dashboard/-hooks/useWorkflows.ts.
// Not imported from there because that module is route-scoped (under a route's
// `-hooks` folder) and this hook needs to be usable outside the dashboard route;
// duplicated deliberately per the plan, kept minimal and in lockstep with the source.
// Exported so useGitHubEventStream can apply the same filter when merging a
// pushed run into the drill-down (getWorkflowRuns) cache.
export const branchMatch = (branch: string, filters: string[]): boolean => {
  if (filters.length === 0) return true;
  if (filters.includes(branch)) return true;
  return filters.filter(f => f.endsWith("*")).map(f => f.slice(0, -1)).some(p => branch.startsWith(p));
};

// Worst-status ordering, matching the priority table used to compute a repo's
// overallStatus across its workflows in useWorkflows.ts's buildFakeRepo: Red is
// worst, Green/None are best.
const STATUS_PRIORITY: Record<WorkflowStatus, number> = { Red: 0, Amber: 1, Running: 2, Waiting: 3, None: 4, Green: 5 };

const worstStatus = (statuses: (WorkflowStatus | undefined)[]): WorkflowStatus | undefined =>
  statuses.reduce<WorkflowStatus | undefined>((worst, status) => {
    if (!status) return worst;
    if (!worst) return status;
    return STATUS_PRIORITY[status] < STATUS_PRIORITY[worst] ? status : worst;
  }, undefined);

// Pure merge of a pushed workflow run into the cached getWorkflows data, so the
// dashboard can reflect a live SSE update without a GitHub refetch. The
// dashboard only ever shows the latest run per workflow, so a matching run
// replaces the workflow's `runs` entirely rather than being appended.
export const mergeWorkflowRun = (
  repositories: RepositoryModel[],
  owner: string,
  repo: string,
  run: WorkflowRunModel,
  branchFilter: string[],
): RepositoryModel[] => {
  const repoIndex = repositories.findIndex(
    (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repo.toLowerCase(),
  );
  if (repoIndex === -1) return repositories;

  const targetRepo = repositories[repoIndex];
  const workflows = targetRepo.workflows ?? [];
  const workflowIndex = workflows.findIndex((w) => w.id === run.workflowId);
  if (workflowIndex === -1) return repositories;

  if (!branchMatch(run.headBranch, branchFilter)) return repositories;

  const updatedWorkflow: WorkflowModel = {
    ...workflows[workflowIndex],
    runs: [run],
    overallStatus: worstStatus([run.workflowStatus]),
  };

  const updatedWorkflows = workflows.map((w, i) => (i === workflowIndex ? updatedWorkflow : w));

  const updatedRepo: RepositoryModel = {
    ...targetRepo,
    workflows: updatedWorkflows,
    overallStatus: worstStatus(updatedWorkflows.map((w) => w.overallStatus)),
  };

  return repositories.map((r, i) => (i === repoIndex ? updatedRepo : r));
};
