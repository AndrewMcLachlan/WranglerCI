import { useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { postWorkflows } from "../../../api";
import type { RepositoryModel, WorkflowModel } from "../../../api";

// TODO: Remove this fake data - temporary for testing issue #76
const includeFakeData = import.meta.env.DEV;
const generateFakeWorkflows = (count: number): WorkflowModel[] =>
  Array.from({ length: count }, (_, i) => {
    const statuses = ["Green", "Red", "Amber", "Running", "Waiting"] as const;
    const status = statuses[i % statuses.length];
    const now = new Date();
    const updatedAt = new Date(now.getTime() - (i * 15 + 5) * 60000).toISOString();
    return {
      id: 90000 + i,
      nodeId: `fake-wf-${i}`,
      name: `Workflow ${i + 1}`,
      htmlUrl: `https://github.com/FakeOrg/big-repo/blob/main/.github/workflows/wf-${i}.yml`,
      overallStatus: status,
      runStatus: status,
      runs: [{
        id: 800000 + i,
        workflowId: 90000 + i,
        nodeId: `fake-run-${i}`,
        conclusion: status === "Green" ? "success" : status === "Red" ? "failure" : null,
        headBranch: i % 3 === 0 ? "main" : i % 3 === 1 ? "develop" : `feature/task-${i}`,
        event: "push",
        runNumber: 100 + i,
        triggeringActor: "fake-user",
        status: status === "Green" || status === "Red" || status === "Amber" ? "completed" : "in_progress",
        createdAt: updatedAt,
        updatedAt,
        htmlUrl: `https://github.com/FakeOrg/big-repo/actions/runs/${800000 + i}`,
        workflowStatus: status,
      }],
    };
  });

const fakeRepo: RepositoryModel = {
  name: "big-repo",
  owner: "FakeOrg",
  nodeId: "fake-repo-node",
  htmlUrl: "https://github.com/FakeOrg/big-repo",
  overallStatus: "Red",
  workflows: generateFakeWorkflows(40),
};

export const useWorkflows = () => {

  const { data: selectedRepositories } = useSelectedRepositories();

  return useQuery({
    queryKey: ["getWorkflows", selectedRepositories],
    queryFn: async () => {
      var result = await postWorkflows({
        body: {
          repositories: selectedRepositories
        }
      })
      const data = result.data ?? [];
      return includeFakeData ? [...data, fakeRepo] : data;
    },
  });
}
