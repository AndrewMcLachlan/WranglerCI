import { createFileRoute } from "@tanstack/react-router";
import { Gates } from "./gates/-components/Gates";

export const Route = createFileRoute("/gates")({
  component: Gates,
});
