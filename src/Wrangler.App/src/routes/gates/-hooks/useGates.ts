import { useQuery } from "@tanstack/react-query";
import { postGates } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";
import { PAGE_STALE_TIME } from "../../../pageFreshness";

export const useGates = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  // Gates follows the dashboard: only repos with selected workflows. The
  // unified list also holds PR-only/security-only entries, which have no
  // business here.
  const repositories = selectedRepositories
    .filter(hasDashboardWorkflows)
    .map((r) => ({ owner: r.owner, name: r.name }));

  return useQuery({
    queryKey: ["gates", repositories],
    queryFn: async () => {
      const result = await postGates({ body: { repositories } });
      return result.data ?? [];
    },
    enabled: repositories.length > 0,
    // No webhook carries gate state, so this poll is the only live path while
    // the page is open; arriving refetches regardless.
    refetchInterval: 5 * 60 * 1000,
    staleTime: PAGE_STALE_TIME,
  });
};
