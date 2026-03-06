import { useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { postWorkflows } from "../../../api";

export const useWorkflows = () => {

  const { data: selectedRepositories } = useSelectedRepositories();

  return useQuery({
    queryKey: ["getWorkflows", selectedRepositories],
    queryFn: async () => {
      var result = await postWorkflows({
        body: {
          repositories: selectedRepositories
        }
      })
      return result.data;
    },
  });
}
