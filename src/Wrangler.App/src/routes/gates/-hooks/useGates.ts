import { useQuery } from "@tanstack/react-query";
import { postGates } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";

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
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
};
