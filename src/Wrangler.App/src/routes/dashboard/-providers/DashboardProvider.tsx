import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import { createContext, useContext, type PropsWithChildren } from "react";
import type { WorkflowStatus } from "../../../api";

interface DashboardContextType {
  branchFilter: string[];
  addBranchFilter: (branch: string) => void;
  setBranchFilter: (branches: string[]) => void;
  statusFilter: WorkflowStatus[];
  setStatusFilter: (statuses: WorkflowStatus[]) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Both the Filters control and useWorkflows read these filters. moo-ds
// useLocalStorage only re-syncs across tabs (via the storage event), never
// within one document, so two independent instances would not see each
// other's writes — the provider owns a single instance and shares it.
export const DashboardProvider: React.FC<PropsWithChildren<unknown>> = ({ children }) => {

  const [branchFilter, setBranchFilter] = useLocalStorage<string[]>("branchFilter", []);
  const [statusFilter, setStatusFilter] = useLocalStorage<WorkflowStatus[]>("dashboardStatusFilter", []);

  const addBranchFilter = (branch: string) => {
    if (branchFilter.includes(branch)) {
      return; // Prevent adding duplicates
    }
    setBranchFilter(prev => [...prev, branch]);
  }

  return (
    <DashboardContext.Provider value={{ branchFilter, addBranchFilter, setBranchFilter, statusFilter, setStatusFilter }}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  return context;
}
