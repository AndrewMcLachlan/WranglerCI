import { useQuery } from "@tanstack/react-query";
import { postRepositoriesByOwnerByRepoWorkflowsByWorkflowIdRuns } from "../../../api";

export const useWorkflowRuns = (owner: string, repo: string, workflowId: number, branchFilters: string[]) => {
  return useQuery({
    queryKey: ["getWorkflowRuns", owner, repo, workflowId, branchFilters],
    queryFn: async () => {
      const result = await postRepositoriesByOwnerByRepoWorkflowsByWorkflowIdRuns({
        path: {
          owner,
          repo,
          workflowId,
        },
        body: {
          branchFilters: branchFilters,
        }
      });
      return result.data;
    },
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 60 * 2, // 2 minutes
    staleTime: 1000 * 60, // 1 minute
  });
}
