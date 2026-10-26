import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { usePrAuthors } from "./usePrAuthors";
import { postPullRequests } from "../../../api";
import { PAGE_STALE_TIME } from "../../../pageFreshness";

/** What the pull request list fetches, so the cache can be warmed for it. */
export const pullRequestsQueryOptions = (repositories: { owner: string; name: string }[], authors: string[], mine: boolean = false) => ({
  queryKey: ["pullRequests", repositories, mine ? "mine" : authors],
  queryFn: async () => {
    const result = await postPullRequests({ body: mine ? { repositories, mine } : { repositories, authors } });
    return result.data;
  },
  // SSE drives freshness; polling is a safety net for missed events.
  refetchInterval: 30 * 60 * 1000,
  staleTime: PAGE_STALE_TIME,
});

/** All is the stored author filter; mine is what's assigned to you, plus what you opened that nobody is assigned. */
export type PullRequestScope = "all" | "mine";

export const usePullRequests = (scope: PullRequestScope = "all") => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: authors } = usePrAuthors();
  const mine = scope === "mine";

  const repositories = selectedRepositories
    .filter(r => r.pullRequests === true)
    .map(r => ({ owner: r.owner, name: r.name }));

  return useQuery({
    ...pullRequestsQueryOptions(repositories, authors, mine),
    enabled: repositories.length > 0 && (mine || authors.length > 0),
    // The author filter is part of the query key, so every change to it lands
    // on an empty cache entry: without this the list blanks while it refetches.
    placeholderData: keepPreviousData,
  });
}
