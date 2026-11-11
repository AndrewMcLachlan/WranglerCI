import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGates } from "../../../gates/-hooks/useGates";
import { useDashboardWorkflows } from "../../-hooks/useWorkflows";
import { gatesAheadOfDashboard } from "../../../../hooks/gateStatus";

/** Refetches the dashboard once for each gate on a run it isn't showing yet. */
export const DashboardGateSync: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: repositories } = useDashboardWorkflows();
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
