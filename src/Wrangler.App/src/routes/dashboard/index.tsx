import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "./-components/overview/Overview";

export const Route = createFileRoute("/dashboard/")({
  component: Overview,
});
