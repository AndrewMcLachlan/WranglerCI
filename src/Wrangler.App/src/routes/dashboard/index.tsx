import { createFileRoute, redirect } from "@tanstack/react-router";
import { Overview } from "./-components/overview/Overview";
import { DASHBOARD_VIEW_STORAGE_KEY } from "./-hooks/useDashboardView";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: () => {
    // moo-ds useLocalStorage JSON-encodes values, so the literal stored
    // string is e.g. "\"nested\"" — parse before comparing.
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY) : null;
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
