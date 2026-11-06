import { createFileRoute } from "@tanstack/react-router";
import { PullRequests } from "./-components/PullRequests.tsx";
import { isPullRequestScope, type PullRequestScope } from "./-hooks/usePullRequests";

export const Route = createFileRoute("/pull-requests/")({
  component: PullRequests,
  validateSearch: (search: Record<string, unknown>): { tab?: PullRequestScope } => (isPullRequestScope(search.tab) ? { tab: search.tab } : {}),
  staticData: { title: "Pull Requests" },
});
