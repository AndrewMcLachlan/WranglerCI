import type { WorkflowRunModel } from "../../../api";
import { WorkflowRunCard } from "./WorkflowRunCard";

export const WorkflowRunList: React.FC<WorkflowRunListProps> = ({ runs }) => (
  <div className="workflow-run-list">
    {(!runs || runs.length === 0) && (
      <section className="workflow-run-card">No runs found.</section>
    )}
    {runs?.map((run) => (
      <WorkflowRunCard key={run.id} workflowRun={run} />
    ))}
  </div>
);

export interface WorkflowRunListProps {
  runs?: WorkflowRunModel[];
}
