import { useQuery } from "@tanstack/react-query";
import { postGates } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";

export const useGates = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  const repositories = selectedRepositories.map((r) => ({ owner: r.owner, name: r.name }));

  return useQuery({
    queryKey: ["gates", repositories],
    queryFn: async () => {
      const result = await postGates({ body: { repositories } });
      return result.data ?? [];
    },
    enabled: repositories.length > 0,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
};
