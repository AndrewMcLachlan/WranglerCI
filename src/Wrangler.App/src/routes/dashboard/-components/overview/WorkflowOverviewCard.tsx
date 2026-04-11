import type { WorkflowModel } from "../../../../api";
import StatusIndicator from "../shared/StatusIndicator";
import { RunInfo } from "./RunInfo";

export const WorkflowOverviewCard: React.FC<{ workflow: WorkflowModel }> = ({ workflow }) => {
  const runs = workflow.runs ?? [];

  return (
    <div className="overview-card">
      <a className="overview-card-header" href={workflow.htmlUrl?.replace("blob/main/.github", "actions")} target="_blank" rel="noopener noreferrer">
        <StatusIndicator status={workflow.overallStatus} />
        <h3>{workflow.name}</h3>
      </a>
      <div className="overview-card-body">
        {runs.map((run) => (
          <RunInfo key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
};
