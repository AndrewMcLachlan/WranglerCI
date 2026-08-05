import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { REPOSITORIES_KEY, selectedRepositoriesQueryOptions, type SelectedRepository } from "./repositoryFeatures";

export type { SelectedRepository } from "./repositoryFeatures";

export const useSelectedRepositories = () =>
  useQuery(selectedRepositoriesQueryOptions(localStorage));

export const useUpdateSelectedRepositories = () => {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repositories: SelectedRepository[]) => {
      localStorage.setItem(REPOSITORIES_KEY, JSON.stringify(repositories));
    },
    onSettled: (_data, _error, variables) => {
      // The live query keys are ["selectedRepositories", <data>], so a plain
      // refetch matches nothing useful; push the written list into every
      // matching cached query so sibling subscribers re-render immediately.
      queryClient.setQueriesData({ queryKey: ["selectedRepositories"] }, variables);
    },
  });
}
