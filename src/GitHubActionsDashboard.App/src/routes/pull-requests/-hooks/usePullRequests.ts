import { useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { usePrAuthors } from "./usePrAuthors";
import { postPullRequests } from "../../../api";

export const usePullRequests = () => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: authors } = usePrAuthors();

  const repositories = selectedRepositories.map(r => ({ owner: r.owner, name: r.name }));

  return useQuery({
    queryKey: ["pullRequests", repositories, authors],
    queryFn: async () => {
      const result = await postPullRequests({
        body: {
          repositories,
          authors,
        },
      });
      return result.data;
    },
    enabled: repositories.length > 0 && authors.length > 0,
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}
