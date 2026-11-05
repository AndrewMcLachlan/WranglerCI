import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { usePrAuthors } from "./usePrAuthors";
import { postPullRequests } from "../../../api";
import { PAGE_STALE_TIME } from "../../../pageFreshness";

/** What the pull request list fetches, so the cache can be warmed for it. */
export const pullRequestsQueryOptions = (repositories: { owner: string; name: string }[], authors: string[], scope: PullRequestScope = "all") => ({
  queryKey: ["pullRequests", repositories, scope === "all" ? authors : scope],
  queryFn: async () => {
    const result = await postPullRequests({ body: scope === "all" ? { repositories, authors } : { repositories, mine: scope === "mine", bots: scope === "bots" } });
    return result.data;
  },
  // SSE drives freshness; polling is a safety net for missed events.
  refetchInterval: 30 * 60 * 1000,
  staleTime: PAGE_STALE_TIME,
});

/** All is every pull request, narrowed by the stored author filter when it has any; mine is what's assigned to you, plus what you opened that nobody is assigned; bots is anything a bot opened. */
export type PullRequestScope = "all" | "mine" | "bots";

export const isPullRequestScope = (value: unknown): value is PullRequestScope =>
  value === "all" || value === "mine" || value === "bots";

export const usePullRequests = (scope: PullRequestScope = "all") => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: authors } = usePrAuthors();

  const repositories = selectedRepositories
    .filter(r => r.pullRequests === true)
    .map(r => ({ owner: r.owner, name: r.name }));

  return useQuery({
    ...pullRequestsQueryOptions(repositories, authors, scope),
    enabled: repositories.length > 0,
    // The author filter is part of the query key, so every change to it lands
    // on an empty cache entry: without this the list blanks while it refetches.
    placeholderData: keepPreviousData,
  });
}
