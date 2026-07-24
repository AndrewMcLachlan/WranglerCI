import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import type { WorkflowStatus } from "../../../api";

/**
 * The workflow statuses to show on the dashboard. An empty array means "show
 * everything" (the default); otherwise only workflows whose overall status is
 * selected are shown, and repositories left with no matching workflows drop
 * out. Applied client-side across all three dashboard views.
 */
export const useDashboardStatusFilter = () =>
  useLocalStorage<WorkflowStatus[]>("dashboardStatusFilter", []);
