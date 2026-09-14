import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { client } from "../../../api/client.gen";

export interface UserSearchResult {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

const MIN_QUERY_LENGTH = 2;

/**
 * Debounced GitHub-user search for the PR author typeahead.
 *
 * Calls the shared axios `client` directly: `npm run generate` is blocked by
 * the TypeScript 7 bump (@hey-api/openapi-ts is incompatible), so there is no
 * generated function for this endpoint yet.
 */
export const useUserSearch = (query: string) => {
  const [debounced] = useDebounce(query.trim(), 300);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: ["userSearch", debounced],
    queryFn: async () => {
      const result = await client.get<UserSearchResult[], unknown, false>({
        url: "/users/search",
        query: { q: debounced },
      });
      return result.data ?? [];
    },
    enabled,
    staleTime: 60 * 1000,
  });
};
