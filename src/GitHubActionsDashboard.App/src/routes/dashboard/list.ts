import { createFileRoute } from "@tanstack/react-router";
import { List } from "./-components/List";

export const Route = createFileRoute("/dashboard/list")({
  component: List,
});
