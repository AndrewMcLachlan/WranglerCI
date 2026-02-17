import { createFileRoute } from "@tanstack/react-router";
import { PullRequests } from "./-components/PullRequests.tsx";

export const Route = createFileRoute("/pull-requests/")({
    component: PullRequests,
});
