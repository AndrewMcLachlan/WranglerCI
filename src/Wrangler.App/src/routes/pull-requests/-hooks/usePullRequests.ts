import { useQuery } from "@tanstack/react-query";
import { usePrRepositories } from "./usePrRepositories";
import { usePrAuthors } from "./usePrAuthors";
import { postPullRequests } from "../../../api";

export const usePullRequests = () => {

  const { data: prRepositories } = usePrRepositories();
  const { data: authors } = usePrAuthors();

  const repositories = prRepositories.map(r => ({ owner: r.owner, name: r.name }));

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
    // SSE drives freshness; polling is a safety net for missed events.
    refetchInterval: 10 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });
}
