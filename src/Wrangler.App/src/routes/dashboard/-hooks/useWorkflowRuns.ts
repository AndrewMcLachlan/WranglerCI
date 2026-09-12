import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { postRepositoriesByOwnerByRepoWorkflowsByWorkflowIdRuns } from "../../../api";
import { PAGE_STALE_TIME } from "../../../pageFreshness";

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
    // Branch filters are part of the query key: without this the drill-down
    // collapses while the filtered runs load.
    placeholderData: keepPreviousData,
    // SSE drives freshness; polling is a safety net for missed events.
    refetchInterval: 1000 * 60 * 10, // 10 minutes
    staleTime: PAGE_STALE_TIME,
  });
}
