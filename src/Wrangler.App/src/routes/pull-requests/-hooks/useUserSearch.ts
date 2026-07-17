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
 * Debounced GitHub-user search for the PR author typeahead (issue #143).
 *
 * Called through the shared generated axios `client` (same baseURL/credentials
 * as the generated SDK) rather than a generated `getUsersSearch`, because
 * `npm run generate` is currently broken by the TypeScript 7 bump on main
 * (@hey-api/openapi-ts is incompatible with TS 7). Switch to the generated SDK
 * function once client generation is restored.
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
