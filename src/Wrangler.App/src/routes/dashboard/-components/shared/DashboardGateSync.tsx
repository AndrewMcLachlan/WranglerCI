import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGates } from "../../../gates/-hooks/useGates";
import { useSelectedRepositories } from "../../../settings/-hooks/useSelectedRepositories";
import { useDashboardContext } from "../../-providers/DashboardProvider";
import { workflowsQueryOptions } from "../../-hooks/useWorkflows";
import { gatesAheadOfDashboard } from "../../../../hooks/gateStatus";

/** Refetches the dashboard once for each gate on a run it isn't showing yet. */
export const DashboardGateSync: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: selectedRepositories } = useSelectedRepositories();
  const { branchFilter } = useDashboardContext();
  const { data: repositories } = useQuery(workflowsQueryOptions(selectedRepositories, branchFilter));
  const { data: gates } = useGates();

  const refetchedForRef = useRef(new Set<string>());

  useEffect(() => {
    if (!repositories || !gates) return;
    const unseen = gatesAheadOfDashboard(repositories, gates).filter((id) => !refetchedForRef.current.has(id));
    if (unseen.length === 0) return;
    for (const id of unseen) refetchedForRef.current.add(id);
    queryClient.invalidateQueries({ queryKey: ["getWorkflows"] });
  }, [repositories, gates, queryClient]);

  return null;
};
