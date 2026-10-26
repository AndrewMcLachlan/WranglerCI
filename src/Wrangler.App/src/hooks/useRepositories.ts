import { useQuery } from "@tanstack/react-query";
import { getRepositoriesOptions } from "../api/@tanstack/react-query.gen";

export const useRepositories = (enabled: boolean = true) => {
  return useQuery({
    ...getRepositoriesOptions(),
    enabled,
  });
}
