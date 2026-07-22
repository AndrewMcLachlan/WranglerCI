import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureMigrated, REPOSITORIES_KEY, type SelectedRepository } from "./repositoryFeatures";

export type { SelectedRepository } from "./repositoryFeatures";

export const useSelectedRepositories = () => {

  ensureMigrated(localStorage);
  const data = JSON.parse(localStorage.getItem(REPOSITORIES_KEY) ?? "[]") as SelectedRepository[];

  return useQuery({
    queryKey: ["selectedRepositories", data],
    queryFn: () => {
      return data;
    },
    initialData: [],
  })
}

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
