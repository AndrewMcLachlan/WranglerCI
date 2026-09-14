import { createFileRoute, redirect } from "@tanstack/react-router";
import { Overview } from "./-components/overview/Overview";
import { DASHBOARD_VIEW_STORAGE_KEY } from "./-hooks/useDashboardView";
import { isNarrowViewport } from "../../hooks/useIsNarrow";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: () => {
    // moo-ds useLocalStorage JSON-encodes values, so the literal stored
    // string is e.g. "\"nested\"" — parse before comparing.
    if (typeof window === "undefined") return;
    // A narrow viewport has no view switcher, so a stored table view must not
    // drag it somewhere it cannot get back from.
    if (isNarrowViewport()) return;
    const raw = window.localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY);
    if (!raw) return;
    try {
      const view = JSON.parse(raw);
      if (view === "nested") throw redirect({ to: "/dashboard/nested" });
      if (view === "list") throw redirect({ to: "/dashboard/list" });
    } catch (err) {
      // Re-throw redirects; swallow JSON parse errors so a corrupt entry
      // can't deadlock the dashboard.
      if (err && typeof err === "object" && "to" in err) throw err;
    }
  },
  component: Overview,
});
