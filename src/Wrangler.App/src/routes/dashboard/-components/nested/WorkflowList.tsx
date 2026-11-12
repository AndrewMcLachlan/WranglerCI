import type { WorkflowModel } from "../../../../api";
import type { PendingWorkflow } from "../../-hooks/useWorkflows";
import { PlaceholderCard } from "../shared/Placeholder";
import { withPending, workflowItemKey } from "../shared/withPending";
import { WorkflowCard } from "./WorkflowCard";

export const WorkflowList: React.FC<WorkflowListProps> = ({ workflows = [], pendingWorkflows = [] }) => {

  if (workflows.length === 0 && pendingWorkflows.length === 0) {
    return <p>No workflows found.</p>;
  }

  return (
    <section className="workflow-list">
      {withPending(workflows, pendingWorkflows).map((item) => item.workflow
        ? <WorkflowCard key={workflowItemKey(item)} workflow={item.workflow} />
        : <PlaceholderCard key={workflowItemKey(item)} title={item.pending.name} label={`Loading ${item.pending.name ?? "workflow"}`} />
      )}
    </section>

  );
}

export interface WorkflowListProps {
  workflows?: WorkflowModel[]
  pendingWorkflows?: PendingWorkflow[]
}
