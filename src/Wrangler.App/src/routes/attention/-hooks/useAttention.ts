import { useQuery } from "@tanstack/react-query";
import { postAttention } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";

export const useAttention = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  const repositories = selectedRepositories.map((r) => ({ owner: r.owner, name: r.name }));

  return useQuery({
    queryKey: ["attention", repositories],
    queryFn: async () => {
      const result = await postAttention({ body: { repositories } });
      return result.data ?? [];
    },
    enabled: repositories.length > 0,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });
};
