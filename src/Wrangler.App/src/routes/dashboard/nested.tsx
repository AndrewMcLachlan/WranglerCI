import { createFileRoute, redirect } from "@tanstack/react-router";
import { isNarrowViewport } from "../../hooks/useIsNarrow";
import { Dashboard } from "./-components/nested/Dashboard";

/** A narrow viewport gets the card view only, and this one is a table. */
const cardViewOnlyWhenNarrow = () => {
  if (isNarrowViewport()) throw redirect({ to: "/dashboard" });
};

export const Route = createFileRoute("/dashboard/nested")({
  beforeLoad: cardViewOnlyWhenNarrow,
  component: Dashboard,
});
