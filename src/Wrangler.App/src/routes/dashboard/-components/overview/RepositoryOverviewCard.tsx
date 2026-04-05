import { useState } from "react";
import { Icon } from "@andrewmclachlan/moo-ds";
import type { RepositoryModel, WorkflowModel } from "../../../../api";
import StatusIndicator from "../shared/StatusIndicator";
import { WorkflowRow } from "./WorkflowRow";

const isAttentionNeeded = (workflow: WorkflowModel): boolean => {
  const status = workflow.overallStatus;
  return status === "Red" || status === "Amber";
};

export const RepositoryOverviewCard: React.FC<{ repository: RepositoryModel }> = ({ repository }) => {
  const [expanded, setExpanded] = useState(false);
  const workflows = [...(repository.workflows ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const attentionWorkflows = workflows.filter(isAttentionNeeded);
  const passingWorkflows = workflows.filter((w) => !isAttentionNeeded(w));
  const hasCollapsible = attentionWorkflows.length > 0 && passingWorkflows.length > 0;

  return (
    <div className="overview-card">
      <div className="overview-card-header">
        <StatusIndicator status={repository.overallStatus} />
        <h3>{repository.name}</h3>
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
