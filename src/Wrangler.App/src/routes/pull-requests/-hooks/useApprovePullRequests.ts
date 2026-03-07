import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postPullRequestsApprove, type ApprovalResult } from "../../../api";

interface UseApprovePullRequestsOptions {
  onResults?: (results: ApprovalResult[]) => void;
}

export const useApprovePullRequests = (options?: UseApprovePullRequestsOptions) => {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pullRequests: { owner: string; repo: string; number: number | string }[]) => {
      const result = await postPullRequestsApprove({
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
  });
}
