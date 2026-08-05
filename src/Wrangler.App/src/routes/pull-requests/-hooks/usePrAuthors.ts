import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PR_AUTHORS_KEY, prAuthorsQueryOptions } from "./prAuthorsStorage";

export const usePrAuthors = () => useQuery(prAuthorsQueryOptions(localStorage));

export const useUpdatePrAuthors = () => {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (authors: string[]) => {
      localStorage.setItem(PR_AUTHORS_KEY, JSON.stringify(authors));
    },
    onSettled: () => {
      queryClient.refetchQueries({
        queryKey: [PR_AUTHORS_KEY],
      });
    },
  });
}
