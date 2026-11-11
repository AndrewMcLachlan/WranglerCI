import { useMemo } from "react";
import { useQueries, useQueryClient, type QueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { useDashboardContext } from "../-providers/DashboardProvider";
import { fetchRepositoryWorkflows } from "./workflowsBatch";
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";
import { PAGE_STALE_TIME } from "../../../pageFreshness";
import { applyPendingGates } from "../../../hooks/gateStatus";
import { useGates } from "../../gates/-hooks/useGates";
import type { RepositoryModel, WorkflowModel, WorkflowStatus } from "../../../api";
import type { SelectedRepository } from "../../settings/-hooks/repositoryFeatures";

// Keep only workflows whose overall status is selected, and drop repositories
// left with none. An empty filter is no constraint. Client-side so it reshapes
// the same fetched data across all three views without a refetch. Exported for
// unit testing.
export const filterByStatus = (repositories: RepositoryModel[], statuses: WorkflowStatus[]): RepositoryModel[] => {
  if (statuses.length === 0) return repositories;
  const wanted = new Set(statuses);
  return repositories
    .map((repo) => ({ ...repo, workflows: repo.workflows?.filter((w) => w.overallStatus && wanted.has(w.overallStatus)) ?? [] }))
    .filter((repo) => repo.workflows.length > 0);
};

// TODO: Remove this fake data - temporary for testing issue #76
const includeFakeData = import.meta.env.DEV;

const branchMatch = (branch: string, filters: string[]): boolean => {
  if (filters.length === 0) return true;
  if (filters.includes(branch)) return true;
  return filters.filter(f => f.endsWith("*")).map(f => f.slice(0, -1)).some(p => branch.startsWith(p));
};

type FakeRun = { branch: string; status: "Green" | "Red" | "Amber" | "Running" | "Waiting" };

const generateFakeWorkflows = (count: number, filters: string[]): WorkflowModel[] => {
  const statuses = ["Green", "Red", "Amber", "Running", "Waiting"] as const;
  const now = Date.now();

  return Array.from({ length: count }, (_, i) => {
    // Every workflow has a main run
    const allRuns: FakeRun[] = [{ branch: "main", status: statuses[i % statuses.length] }];

    // ~50% have a feature branch
    if (i % 2 === 0) {
      allRuns.push({ branch: `feature/task-${100 + i}`, status: statuses[(i + 1) % statuses.length] });
    }

    // ~20% have a dependabot branch
    if (i % 5 === 0) {
      allRuns.push({ branch: `dependabot/npm/lodash-${i}`, status: "Green" });
    }

    // Filter runs by branch filters
    const matchedRuns = allRuns.filter(r => branchMatch(r.branch, filters));

    // Determine overall status from matched runs
    const statusPriority: Record<string, number> = { Red: 0, Amber: 1, Running: 2, Waiting: 3, Green: 4 };
    const worstStatus = matchedRuns.reduce<typeof statuses[number]>((worst, r) =>
      (statusPriority[r.status] ?? 4) < (statusPriority[worst] ?? 4) ? r.status : worst, "Green");

    return {
      id: 90000 + i,
      nodeId: `fake-wf-${i}`,
      name: `Workflow ${i + 1}`,
      htmlUrl: `https://github.com/FakeOrg/big-repo/blob/main/.github/workflows/wf-${i}.yml`,
      overallStatus: matchedRuns.length > 0 ? worstStatus : undefined,
      runs: matchedRuns.map((r, ri) => ({
        id: 800000 + i * 10 + ri,
        workflowId: 90000 + i,
        nodeId: `fake-run-${i}-${ri}`,
        conclusion: r.status === "Green" ? "success" : r.status === "Red" ? "failure" : null,
        headBranch: r.branch,
        event: "push",
        runNumber: 100 + i,
        triggeringActor: "fake-user",
        status: r.status === "Green" || r.status === "Red" || r.status === "Amber" ? "completed" : "in_progress",
        createdAt: new Date(now - (i * 15 + ri * 5 + 5) * 60000).toISOString(),
        updatedAt: new Date(now - (i * 15 + ri * 5 + 5) * 60000).toISOString(),
        htmlUrl: `https://github.com/FakeOrg/big-repo/actions/runs/${800000 + i * 10 + ri}`,
        workflowStatus: r.status,
      })),
    };
  }).filter(w => w.runs.length > 0);
};

const buildFakeRepo = (filters: string[]): RepositoryModel => {
  const workflows = generateFakeWorkflows(40, filters);
  const statusPriority: Record<string, number> = { Red: 0, Amber: 1, Running: 2, Waiting: 3, None: 4, Green: 5 };
  const overallStatus = workflows.reduce<string>((worst, w) => {
    const s = w.overallStatus ?? "None";
    return (statusPriority[s] ?? 4) < (statusPriority[worst] ?? 4) ? s : worst;
  }, "None");

  return {
    name: "big-repo",
    owner: "FakeOrg",
    ownerName: "Fake Org",
    nodeId: "fake-repo-node",
    htmlUrl: "https://github.com/FakeOrg/big-repo",
    overallStatus: overallStatus as RepositoryModel["overallStatus"],
    workflows,
  };
};

const sharedOptions = {
  // Workflow runs are not cached server-side (only the workflow definitions
  // are), so each fetch costs a GitHub call per selected workflow. The stream
  // pushes runs into this cache as they happen; the interval is the backstop
  // for repos whose webhooks were never wired up.
  refetchInterval: 30 * 60 * 1000,
  staleTime: PAGE_STALE_TIME,
  refetchOnWindowFocus: false,
};

/**
 * What the dashboard fetches for one repository, without the view's own
 * concerns, so the cache can be warmed for a page nobody is looking at yet.
 * One entry per repository: adding a repository fetches only that one.
 */
export const workflowsQueryOptions = (repository: SelectedRepository, branchFilter: string[]) => {
  const { owner, name, workflows } = repository;
  return {
    ...sharedOptions,
    queryKey: ["getWorkflows", { owner, name, workflows }, branchFilter],
    queryFn: () => fetchRepositoryWorkflows({ owner, name, workflows }, branchFilter),
  };
};

const fakeWorkflowsQueryOptions = (branchFilter: string[]) => ({
  ...sharedOptions,
  queryKey: ["getWorkflows", "fake", branchFilter],
  queryFn: async () => [buildFakeRepo(branchFilter)],
});

/** A repository with no selected workflows has nothing to show here. The entry stays in settings/PR scope. */
export const dashboardRepositories = (selectedRepositories: SelectedRepository[]) => selectedRepositories.filter(hasDashboardWorkflows);

/** Every dashboard query for the selection, fake data included in development. */
export const dashboardQueries = (selectedRepositories: SelectedRepository[], branchFilter: string[]) => [
  ...dashboardRepositories(selectedRepositories).map((repository) => workflowsQueryOptions(repository, branchFilter)),
  ...(includeFakeData ? [fakeWorkflowsQueryOptions(branchFilter)] : []),
];

/** The repository's most recent runs under any branch filter or workflow selection, to show while the current one loads. */
const latestCachedWorkflows = (queryClient: QueryClient, { owner, name }: SelectedRepository) =>
  queryClient.getQueryCache()
    .findAll({ queryKey: ["getWorkflows", { owner, name }] })
    .filter((query) => query.state.data !== undefined)
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0]?.state.data as RepositoryModel[] | undefined;

/** Identifies a repository regardless of the case GitHub or the user gave its owner and name in. */
export const repositoryKey = ({ owner, name }: { owner: string; name: string }) => `${owner}/${name}`.toLowerCase();

/**
 * Narrow stand-in data to the workflows now selected, so a removed workflow
 * disappears at once, and count the selected workflows it has no runs for yet.
 * Exported for unit testing.
 */
export const narrowToSelection = (repositories: RepositoryModel[], selected: (number | string)[]) => {
  const wanted = new Set(selected.map(String));
  const narrowed = repositories.map((repo) => ({ ...repo, workflows: repo.workflows?.filter((w) => wanted.has(String(w.id))) }));
  const present = new Set(narrowed.flatMap((repo) => repo.workflows ?? []).map((w) => String(w.id)));
  return { repositories: narrowed, missing: [...wanted].filter((id) => !present.has(id)).length };
};

const combineResults = (results: UseQueryResult<RepositoryModel[]>[]) => ({
  data: results.map((r) => r.data),
  placeholder: results.map((r) => r.isPlaceholderData),
  pending: results.map((r) => r.isPending),
  isError: results.some((r) => r.isError),
  error: results.find((r) => r.error)?.error ?? null,
});

/**
 * The dashboard's repositories as loaded so far, unfiltered, the selected
 * repositories still waiting on their first load (loading), and how many newly
 * selected workflows each shown repository is still waiting on (pendingWorkflows).
 */
export const useDashboardWorkflows = () => {

  const queryClient = useQueryClient();
  const { data: selectedRepositories } = useSelectedRepositories();
  const { branchFilter } = useDashboardContext();

  const repositories = useMemo(() => dashboardRepositories(selectedRepositories), [selectedRepositories]);

  const { data, placeholder, pending, isError, error } = useQueries({
    queries: [
      ...repositories.map((repository) => ({
        ...workflowsQueryOptions(repository, branchFilter),
        // A branch filter change moves every repository to a new key, which
        // would otherwise blank the dashboard while it refetches.
        placeholderData: () => latestCachedWorkflows(queryClient, repository),
      })),
      ...(includeFakeData ? [fakeWorkflowsQueryOptions(branchFilter)] : []),
    ],
    combine: combineResults,
  });

  return useMemo(() => {
    const loaded: RepositoryModel[] = [];
    const pendingWorkflows = new Map<string, number>();
    data.forEach((d, i) => {
      if (!d) return;
      const repository = repositories[i];
      if (!repository || !placeholder[i]) {
        loaded.push(...d);
        return;
      }
      const { repositories: narrowed, missing } = narrowToSelection(d, repository.workflows ?? []);
      loaded.push(...narrowed);
      if (missing > 0) pendingWorkflows.set(repositoryKey(repository), missing);
    });

    return {
      data: loaded,
      loading: repositories.filter((_, i) => pending[i]),
      pendingWorkflows,
      isLoading: pending.some(Boolean),
      isError,
      error,
    };
  }, [data, placeholder, pending, repositories, isError, error]);
};

export const useWorkflows = () => {

  const { statusFilter } = useDashboardContext();
  const { data: gates } = useGates();
  const { data, ...rest } = useDashboardWorkflows();

  // GitHub sends no webhook when a run pauses at a gate, so the gate list is
  // the only evidence a run is Waiting.
  const filtered = useMemo(
    () => filterByStatus(applyPendingGates(data, gates ?? []), statusFilter),
    [data, gates, statusFilter]);

  return { data: filtered, ...rest };
}
