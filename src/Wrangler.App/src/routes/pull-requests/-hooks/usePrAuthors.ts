import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const defaultAuthors = ["dependabot[bot]", "renovate[bot]"];

export const usePrAuthors = () => {

  const data = JSON.parse(localStorage.getItem("prAuthors") ?? JSON.stringify(defaultAuthors)) as string[];

  return useQuery({
    queryKey: ["prAuthors", data],
    queryFn: () => {
      return data;
    },
    initialData: defaultAuthors,
  });
}

export const useUpdatePrAuthors = () => {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (authors: string[]) => {
      localStorage.setItem("prAuthors", JSON.stringify(authors));
    },
    onSettled: () => {
      queryClient.refetchQueries({
        queryKey: ["prAuthors"],
      });
    },
  });
}
