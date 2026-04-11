import { createFileRoute } from "@tanstack/react-router";
import { List } from "./-components/list/List";

export const Route = createFileRoute("/dashboard/list")({
  component: List,
});
