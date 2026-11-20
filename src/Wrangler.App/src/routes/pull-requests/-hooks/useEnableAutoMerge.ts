import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { postPullRequestsAutoMerge, type ApprovalResult } from "../../../api";

interface UseEnableAutoMergeOptions {
  onResults?: (results: ApprovalResult[]) => void;
}

export const useEnableAutoMerge = (options?: UseEnableAutoMergeOptions) => {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pullRequests: { owner: string; repo: string; number: number | string }[]) => {
      const result = await postPullRequestsAutoMerge({
        body: {
          pullRequests,
        },
      });
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["pullRequests"],
      });
      options?.onResults?.(data as ApprovalResult[]);
    },
    onError: (error) => {
      toast.error(`Enabling auto-merge failed: ${error.message}`);
    },
  });
}
