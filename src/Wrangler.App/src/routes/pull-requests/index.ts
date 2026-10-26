import { createFileRoute } from "@tanstack/react-router";
import { PullRequests } from "./-components/PullRequests.tsx";
import type { PullRequestScope } from "./-hooks/usePullRequests";

export const Route = createFileRoute("/pull-requests/")({
  component: PullRequests,
  validateSearch: (search: Record<string, unknown>): { tab?: PullRequestScope } => (search.tab === "mine" ? { tab: "mine" } : {}),
  staticData: { title: "Pull Requests" },
});
