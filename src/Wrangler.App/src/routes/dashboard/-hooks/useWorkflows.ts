import { useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { useDashboardContext } from "../-providers/DashboardProvider";
import { postWorkflows } from "../../../api";
import type { RepositoryModel, WorkflowModel } from "../../../api";

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
    nodeId: "fake-repo-node",
    htmlUrl: "https://github.com/FakeOrg/big-repo",
    overallStatus: overallStatus as RepositoryModel["overallStatus"],
    workflows,
  };
};

export const useWorkflows = () => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const { branchFilter } = useDashboardContext();

  return useQuery({
    queryKey: ["getWorkflows", selectedRepositories, branchFilter],
    queryFn: async () => {
      var result = await postWorkflows({
        body: {
          repositories: selectedRepositories,
          branchFilters: branchFilter?.length ? branchFilter : undefined,
        }
      })
      const data = result.data ?? [];
      return includeFakeData ? [...data, buildFakeRepo(branchFilter ?? [])] : data;
    },
  });
}
