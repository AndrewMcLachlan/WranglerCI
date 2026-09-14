import { createFileRoute, redirect } from "@tanstack/react-router";
import { isNarrowViewport } from "../../hooks/useIsNarrow";
import { List } from "./-components/list/List";

/** A narrow viewport gets the card view only, and this one is a table. */
const cardViewOnlyWhenNarrow = () => {
  if (isNarrowViewport()) throw redirect({ to: "/dashboard" });
};

export const Route = createFileRoute("/dashboard/list")({
  beforeLoad: cardViewOnlyWhenNarrow,
  component: List,
});
