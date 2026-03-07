import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SelectedRepository {
  owner: string;
  name: string;
  workflows?: (number | string)[];
}

export const useSelectedRepositories = () => {

  const data = JSON.parse(localStorage.getItem("repositories") ?? "[]") as SelectedRepository[];

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
      localStorage.setItem("repositories", JSON.stringify(repositories));
    },
    onSettled: () => {
      queryClient.refetchQueries({
        queryKey: ["selectedRepositories"],
        exact: true,
      });
    },
  });
}
