import { Icon } from "@andrewmclachlan/moo-ds";
import type { RepositoryModel } from "../../../../api";
import type { PendingWorkflow } from "../../-hooks/useWorkflows";
import { PlaceholderCard } from "../shared/Placeholder";
import { withPending, workflowItemKey } from "../shared/withPending";
import StatusIndicator from "../shared/StatusIndicator";
import { WorkflowOverviewCard } from "./WorkflowOverviewCard";

export const RepositoryWorkflowsExpanded: React.FC<{ repository: RepositoryModel; pendingWorkflows?: PendingWorkflow[] }> = ({ repository, pendingWorkflows }) => {
  const workflows = [...(repository.workflows ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="repo-expanded">
      <div className="repo-header-bar">
        <StatusIndicator status={repository.overallStatus} />
        <h3>{repository.name}</h3>
        <a href={`${repository.htmlUrl}/actions`} target="_blank" rel="noopener noreferrer">
          <Icon icon="arrow-up-right-from-square" />
        </a>
      </div>
      <div className="repo-expanded-grid">
        {withPending(workflows, pendingWorkflows).map((item) => item.workflow
          ? <WorkflowOverviewCard key={workflowItemKey(item)} workflow={item.workflow} />
          : <PlaceholderCard key={workflowItemKey(item)} title={item.pending.name} label={`Loading ${item.pending.name ?? "workflow"}`} />
        )}
      </div>
    </div>
  );
};
