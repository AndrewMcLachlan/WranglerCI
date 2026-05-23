import { createFileRoute } from "@tanstack/react-router";
import { Privacy } from "./-components/Privacy";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});
