
import type { WorkflowModel } from "../../../../api";
import { WorkflowCard } from "./WorkflowCard";

export const WorkflowList: React.FC<WorkflowListProps> = ({ workflows }) => {

  if (!workflows || workflows.length === 0) {
    return <p>No workflows found.</p>;
  }

  return (
    <section className="workflow-list">
      {workflows.length === 0 ? (
        <p>No workflows found.</p>
      ) : workflows.map((workflow) => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      )
      )}
    </section>

  );
}

export interface WorkflowListProps {
  workflows?: WorkflowModel[]
}
