import { useQuery } from "@tanstack/react-query";
import { postGates } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";
import { PAGE_STALE_TIME } from "../../../pageFreshness";

/** What the gates list fetches, so the cache can be warmed for it. */
export const gatesQueryOptions = (repositories: { owner: string; name: string }[]) => ({
  queryKey: ["gates", repositories],
  queryFn: async () => {
    const result = await postGates({ body: { repositories } });
    return result.data ?? [];
  },
  // No webhook carries gate state, so this poll is the only live path while
  // the page is open; arriving refetches regardless.
  refetchInterval: 5 * 60 * 1000,
  staleTime: PAGE_STALE_TIME,
});

export const useGates = (refetchInterval?: number) => {
  const { data: selectedRepositories } = useSelectedRepositories();
  // Gates follows the dashboard: only repos with selected workflows. The
  // unified list also holds PR-only/security-only entries, which have no
  // business here.
  const repositories = selectedRepositories
    .filter(hasDashboardWorkflows)
    .map((r) => ({ owner: r.owner, name: r.name }));

  return useQuery({
    ...gatesQueryOptions(repositories),
    ...(refetchInterval ? { refetchInterval } : {}),
    enabled: repositories.length > 0,
  });
};
