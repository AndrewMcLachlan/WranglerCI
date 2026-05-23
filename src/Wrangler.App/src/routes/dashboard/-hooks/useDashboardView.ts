import { useLocalStorage } from "@andrewmclachlan/moo-ds";

export type DashboardView = "overview" | "nested" | "list";

export const DASHBOARD_VIEW_STORAGE_KEY = "dashboardView";

export const useDashboardView = () => useLocalStorage<DashboardView>(DASHBOARD_VIEW_STORAGE_KEY, "overview");
