import { useState } from "react";
import { Icon } from "@andrewmclachlan/moo-ds";
import { DateTime } from "luxon";
import type { RepositoryModel, WorkflowModel, WorkflowRunModel, WorkflowStatus } from "../../../api";
import { useWorkflows } from "../-hooks/useWorkflows";
import { Spinner } from "../../../components/Spinner";
import StatusIndicator from "./StatusIndicator";
import { Badge } from "./Badge";

const statusPriority: Record<string, number> = {
  Red: 0,
  Amber: 1,
  Waiting: 2,
  Running: 3,
  None: 4,
  Green: 5,
};

const sortByStatus = (a: { overallStatus?: WorkflowStatus }, b: { overallStatus?: WorkflowStatus }) =>
  (statusPriority[a.overallStatus ?? "None"] ?? 4) - (statusPriority[b.overallStatus ?? "None"] ?? 4);

const latestRun = (workflow: WorkflowModel): WorkflowRunModel | undefined =>
  workflow.runs?.[0];

const isAttentionNeeded = (workflow: WorkflowModel): boolean => {
  const status = workflow.overallStatus;
  return status === "Red" || status === "Amber";
};

const WorkflowRow: React.FC<{ workflow: WorkflowModel }> = ({ workflow }) => {
  const run = latestRun(workflow);
  const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });
  const timeAgo = run
    ? DateTime.fromISO(run.updatedAt).toRelative({ style: "long" }) || formatter.format(0, "seconds")
    : undefined;

  return (
    <div className="workflow-row">
      <StatusIndicator status={workflow.overallStatus} />
      <span className="workflow-name">{workflow.name}</span>
      {run && <Badge>{run.headBranch}</Badge>}
      {timeAgo && (
        <span className="workflow-time" title={run ? DateTime.fromISO(run.updatedAt).toFormat("yyyy-MM-dd HH:mm:ss") : undefined}>
          {timeAgo}
        </span>
      )}
    </div>
  );
};

const RepositoryOverviewCard: React.FC<{ repository: RepositoryModel }> = ({ repository }) => {
  const [expanded, setExpanded] = useState(false);
  const workflows = [...(repository.workflows ?? [])].sort(sortByStatus);
  const attentionWorkflows = workflows.filter(isAttentionNeeded);
  const passingWorkflows = workflows.filter((w) => !isAttentionNeeded(w));
  const hasCollapsible = attentionWorkflows.length > 0 && passingWorkflows.length > 0;

  return (
    <div className="overview-card">
      <div className="overview-card-header">
        <StatusIndicator status={repository.overallStatus} />
        <h3>{repository.owner}/{repository.name}</h3>
        <a href={`${repository.htmlUrl}/actions`} target="_blank" rel="noopener noreferrer">
          <Icon icon="arrow-up-right-from-square" />
        </a>
      </div>
      <div className="overview-card-body">
        {attentionWorkflows.map((w) => (
          <WorkflowRow key={w.id} workflow={w} />
        ))}
        {hasCollapsible && !expanded && (
          <button className="passing-summary" onClick={() => setExpanded(true)}>
            +{passingWorkflows.length} passing
          </button>
        )}
        {(!hasCollapsible || expanded) &&
          passingWorkflows.map((w) => (
            <WorkflowRow key={w.id} workflow={w} />
          ))
        }
      </div>
    </div>
  );
};

export const Overview = () => {
  const { data: repositories, isLoading, isError, error } = useWorkflows();

  if (isError) {
    console.error("Error fetching dashboard data:", error);
    return <p>Error loading build info.</p>;
  }

  const sorted = [...(repositories ?? [])].sort(sortByStatus);

  return (
    <div className="overview">
      {isLoading && <Spinner />}
      {!isLoading && (!repositories || repositories.length === 0) && <p>No workflows found.</p>}
      {sorted.map((repo) => (
        <RepositoryOverviewCard key={repo.nodeId} repository={repo} />
      ))}
    </div>
  );
};
