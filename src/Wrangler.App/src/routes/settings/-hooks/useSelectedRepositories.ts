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
    onSettled: () => {
      queryClient.refetchQueries({
        queryKey: ["selectedRepositories"],
        exact: true,
      });
    },
  });
}
