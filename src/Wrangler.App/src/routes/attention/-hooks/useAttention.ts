import { useQuery } from "@tanstack/react-query";
import { postAttention } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { isAttentionOptedIn } from "../../settings/-hooks/repositoryFeatures";

/** What the attention feed fetches, so the cache can be warmed for it. */
export const attentionQueryOptions = (repositories: { owner: string; name: string }[]) => ({
  queryKey: ["attention", repositories],
  queryFn: async () => {
    const result = await postAttention({ body: { repositories } });
    return result.data ?? [];
  },
  refetchInterval: 10 * 60 * 1000,
  staleTime: 10 * 60 * 1000,
});

export const useAttention = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  // Union of every opted-in repo; the component filters items per type on the
  // way back (the endpoint takes one list and returns all item types).
  const repositories = selectedRepositories
    .filter(isAttentionOptedIn)
    .map((r) => ({ owner: r.owner, name: r.name }));

  return useQuery({
    ...attentionQueryOptions(repositories),
    enabled: repositories.length > 0,
  });
};
