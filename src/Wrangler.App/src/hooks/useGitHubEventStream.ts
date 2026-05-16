import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

interface GitHubEvent {
  type: string;
  owner: string;
  repo: string;
  workflowId?: number;
  runId?: number;
  pullRequestNumber?: number;
  deliveryId?: string;
}

const queryKeyPrefixesFor = (evt: GitHubEvent): QueryKey[] => {
  switch (evt.type) {
    case "workflow_run":
    case "check_run":
    case "check_suite":
      return [["getWorkflows"], ["getWorkflowRuns", evt.owner, evt.repo]];
    case "pull_request":
      return [["pullRequests"]];
    default:
      return [];
  }
};

const matchesPrefix = (queryKey: QueryKey, prefix: QueryKey): boolean => {
  if (prefix.length > queryKey.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (queryKey[i] !== prefix[i]) return false;
  }
  return true;
};

export const useGitHubEventStream = (enabled: boolean = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource("/api/events/stream", { withCredentials: true });

    const handle = (rawEvent: MessageEvent) => {
      let parsed: GitHubEvent;
      try {
        parsed = JSON.parse(rawEvent.data);
      } catch {
        return;
      }

      const prefixes = queryKeyPrefixesFor(parsed);
      for (const prefix of prefixes) {
        queryClient.invalidateQueries({
          predicate: (query) => matchesPrefix(query.queryKey, prefix),
        });
      }
    };

    for (const type of ["workflow_run", "check_run", "check_suite", "pull_request"]) {
      source.addEventListener(type, handle);
    }

    return () => {
      source.close();
    };
  }, [enabled, queryClient]);
};
