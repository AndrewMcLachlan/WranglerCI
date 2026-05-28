import { createFileRoute } from "@tanstack/react-router";
import { Attention } from "./attention/-components/Attention";

export const Route = createFileRoute("/attention")({
  component: Attention,
});
