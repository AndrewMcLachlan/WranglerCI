import type { WorkflowModel } from "../../../../api";
import { PlaceholderCard } from "../shared/Placeholder";
import { WorkflowCard } from "./WorkflowCard";

export const WorkflowList: React.FC<WorkflowListProps> = ({ workflows = [], pendingWorkflows = 0 }) => {

  if (workflows.length === 0 && pendingWorkflows === 0) {
    return <p>No workflows found.</p>;
  }

  return (
    <section className="workflow-list">
      {workflows.map((workflow) => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
      {Array.from({ length: pendingWorkflows }, (_, i) => <PlaceholderCard key={i} label="Loading workflow" />)}
    </section>

  );
}

export interface WorkflowListProps {
  workflows?: WorkflowModel[]
  pendingWorkflows?: number
}
