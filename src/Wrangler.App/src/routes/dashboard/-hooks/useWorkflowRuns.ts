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
    // SSE drives freshness; polling is a safety net for missed events.
    refetchInterval: 1000 * 60 * 10, // 10 minutes
    staleTime: 1000 * 60 * 10,
  });
}
