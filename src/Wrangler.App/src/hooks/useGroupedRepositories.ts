import { useQuery } from "@tanstack/react-query";
import { getRepositoriesGroupedOptions } from "../api/@tanstack/react-query.gen";

export const useGroupedRepositories = () => {
  return useQuery({
    ...getRepositoriesGroupedOptions(),
  });
}
