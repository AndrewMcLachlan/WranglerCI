import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGates } from "../../../gates/-hooks/useGates";
import { useSelectedRepositories } from "../../../settings/-hooks/useSelectedRepositories";
import { useDashboardContext } from "../../-providers/DashboardProvider";
import { workflowsQueryOptions } from "../../-hooks/useWorkflows";
import { gatesAheadOfDashboard } from "../../../../hooks/gateStatus";
import type { RepositoryModel } from "../../../../api";

const ACTIVE_GATE_POLL_MS = 30 * 1000;

const hasActiveRuns = (repositories: RepositoryModel[]): boolean =>
  repositories.some((repo) => repo.workflows?.some((workflow) =>
    workflow.runs?.some((run) => run.status !== "completed")));

/** Keeps the dashboard and the gate list in step while either has news for the other. */
export const DashboardGateSync: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: selectedRepositories } = useSelectedRepositories();
  const { branchFilter } = useDashboardContext();
  const { data: repositories } = useQuery(workflowsQueryOptions(selectedRepositories, branchFilter));

  const active = hasActiveRuns(repositories ?? []);
  const { data: gates } = useGates(active ? ACTIVE_GATE_POLL_MS : undefined);

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
