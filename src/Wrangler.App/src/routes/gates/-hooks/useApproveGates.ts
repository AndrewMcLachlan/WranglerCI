import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postGatesApprove, type GateApprovalResult, type GateRef } from "../../../api";

interface UseApproveGatesOptions {
  onResults?: (results: GateApprovalResult[]) => void;
}

export const useApproveGates = (options?: UseApproveGatesOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gates: GateRef[]) => {
      const result = await postGatesApprove({ body: { gates } });
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gates"] });
      options?.onResults?.(data as GateApprovalResult[]);
    },
  });
};
