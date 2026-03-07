import { useLocalStorage } from "@andrewmclachlan/moo-ds";
import { createContext, useContext, type PropsWithChildren } from "react";

interface DashboardContextType {
  branchFilter: string[];
  addBranchFilter: (branch: string) => void;
  removeBranchFilter: (branch: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<PropsWithChildren<unknown>> = ({ children }) => {

  const [branchFilter, setBranchFilter] = useLocalStorage<string[]>("branchFilter", []);

  const addBranchFilter = (branch: string) => {
    if (branchFilter.includes(branch)) {
      return; // Prevent adding duplicates
    }
    setBranchFilter(prev => [...prev, branch]);
  }

  const removeBranchFilter = (branch: string) => {
    setBranchFilter(prev => prev.filter(b => b !== branch));
  }

  return (
    <DashboardContext.Provider value={{ branchFilter, addBranchFilter, removeBranchFilter }}>
      {children}
    </DashboardContext.Provider>
  );
}

/* eslint-disable react-refresh/only-export-components */
export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  return context;
}
