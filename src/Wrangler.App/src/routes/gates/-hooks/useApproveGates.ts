import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { postGatesApprove, type DeploymentGateModel, type GateApprovalResult, type GateRef } from "../../../api";
import { restoreFailedApprovals, withoutApprovedGates } from "../../../hooks/gateStatus";

interface UseApproveGatesOptions {
  onResults?: (results: GateApprovalResult[]) => void;
}

type GatesSnapshot = [readonly unknown[], DeploymentGateModel[] | undefined][];

/**
 * Approves gates and removes them from the list at once. The approval results
 * put back any that failed, so an approval never costs a refetch of the gates.
 */
export const useApproveGates = (options?: UseApproveGatesOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gates: GateRef[]) => {
      const result = await postGatesApprove({ body: { gates } });
      return result.data ?? [];
    },
    onMutate: async (gates): Promise<{ snapshot: GatesSnapshot }> => {
      await queryClient.cancelQueries({ queryKey: ["gates"] });
      const snapshot = queryClient.getQueriesData<DeploymentGateModel[]>({ queryKey: ["gates"] });
      queryClient.setQueriesData<DeploymentGateModel[]>({ queryKey: ["gates"] }, (data) =>
        data ? withoutApprovedGates(data, gates) : data);
      return { snapshot };
    },
    onSuccess: (results, _gates, context) => {
      for (const [queryKey, previous] of context?.snapshot ?? []) {
        if (!previous) continue;
        queryClient.setQueryData<DeploymentGateModel[]>(queryKey, (current) =>
          restoreFailedApprovals(current ?? [], previous, results));
      }
      options?.onResults?.(results);
    },
    onError: (error, _gates, context) => {
      for (const [queryKey, previous] of context?.snapshot ?? []) {
        queryClient.setQueryData(queryKey, previous);
      }
      toast.error(`Approval failed: ${error.message}`);
    },
  });
};
