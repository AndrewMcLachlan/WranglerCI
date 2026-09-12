import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { usePrAuthors } from "./usePrAuthors";
import { postPullRequests } from "../../../api";
import { PAGE_STALE_TIME } from "../../../pageFreshness";

export const usePullRequests = () => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: authors } = usePrAuthors();

  const repositories = selectedRepositories
    .filter(r => r.pullRequests === true)
    .map(r => ({ owner: r.owner, name: r.name }));

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
    // The author filter is part of the query key, so every change to it lands
    // on an empty cache entry: without this the list blanks while it refetches.
    placeholderData: keepPreviousData,
    // SSE drives freshness; polling is a safety net for missed events.
    refetchInterval: 10 * 60 * 1000,
    staleTime: PAGE_STALE_TIME,
  });
}
