import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "./-components/nested/Dashboard";

export const Route = createFileRoute("/dashboard/nested")({
  component: Dashboard,
});
