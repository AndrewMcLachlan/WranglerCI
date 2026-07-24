import { useLocalStorage } from "@andrewmclachlan/moo-ds";

/**
 * Client-side filters for the Deployment Gates table. Empty arrays mean "no
 * constraint" (the default); filters combine with AND across kinds and OR
 * within a kind.
 */
export const useGateEnvironmentFilter = () => useLocalStorage<string[]>("gatesEnvironmentFilter", []);
export const useGateBranchFilter = () => useLocalStorage<string[]>("gatesBranchFilter", []);
export const useGateRepositoryFilter = () => useLocalStorage<string[]>("gatesRepositoryFilter", []);
export const useGateWorkflowFilter = () => useLocalStorage<string[]>("gatesWorkflowFilter", []);
