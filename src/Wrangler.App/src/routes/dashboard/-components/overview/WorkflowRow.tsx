import type { WorkflowModel } from "../../../../api";
import StatusIndicator from "../shared/StatusIndicator";
import { RunInfo } from "./RunInfo";

export const WorkflowRow: React.FC<{ workflow: WorkflowModel }> = ({ workflow }) => {
  const runs = workflow.runs ?? [];

  return (
    <div className="workflow-row">
      <StatusIndicator status={workflow.overallStatus} />
      <a className="workflow-name" href={workflow.htmlUrl?.replace("blob/main/.github", "actions")} target="_blank" rel="noopener noreferrer">{workflow.name}</a>
      {runs.length === 1 && <RunInfo run={runs[0]} />}
      {runs.length > 1 && (
        <div className="workflow-runs">
          {runs.map((run) => (
            <RunInfo key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
};
