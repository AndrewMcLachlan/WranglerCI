import type { WorkflowModel } from "../../../../api";
import StatusIndicator from "../shared/StatusIndicator";
import { workflowActionsUrl } from "../shared/workflowUrls";
import { RunInfo } from "./RunInfo";

export const WorkflowRow: React.FC<{ workflow: WorkflowModel }> = ({ workflow }) => {
  const runs = workflow.runs ?? [];

  return (
    <div className="workflow-row">
      <StatusIndicator status={workflow.overallStatus} />
      <a className="workflow-name" href={workflowActionsUrl(workflow)} target="_blank" rel="noopener noreferrer">{workflow.name}</a>
      {runs.length === 1 && <RunInfo run={runs[0]} workflow={workflow} orientation="right" />}
      {runs.length > 1 && (
        <div className="workflow-runs">
          {runs.map((run) => (
            <RunInfo key={run.id} run={run} workflow={workflow} orientation="right" />
          ))}
        </div>
      )}
    </div>
  );
};
