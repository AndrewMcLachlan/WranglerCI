import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface PrRepository {
  owner: string;
  name: string;
}

/**
 * The repositories scoped to the Pull Requests view, independent of the
 * workflow dashboard's selected repositories (issue #143).
 *
 * On first use (the "prRepositories" key is absent) the scope is seeded from
 * the dashboard's "repositories" selection so existing users see PRs straight
 * away. Once edited, the mutation writes the key and the scope is fully
 * independent — an intentionally-emptied scope persists as [] because the key
 * then exists.
 */
const readPrRepositories = (): PrRepository[] => {
  const stored = localStorage.getItem("prRepositories");
  if (stored !== null) {
    return JSON.parse(stored) as PrRepository[];
  }

  const selected = localStorage.getItem("repositories");
  if (!selected) return [];
  try {
    const parsed = JSON.parse(selected) as PrRepository[];
    return parsed.map(r => ({ owner: r.owner, name: r.name }));
  } catch {
    return [];
  }
};

export const usePrRepositories = () => {
  const data = readPrRepositories();
  return useQuery({
    queryKey: ["prRepositories", data],
    queryFn: () => data,
    initialData: [],
  });
};

export const useUpdatePrRepositories = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repositories: PrRepository[]) => {
      localStorage.setItem("prRepositories", JSON.stringify(repositories));
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: ["prRepositories"] });
    },
  });
};
