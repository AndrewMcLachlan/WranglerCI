import { Icon } from "@andrewmclachlan/moo-ds";
import type { RepositoryModel } from "../../../../api";
import StatusIndicator from "../shared/StatusIndicator";
import { WorkflowOverviewCard } from "./WorkflowOverviewCard";

export const RepositoryWorkflowsExpanded: React.FC<{ repository: RepositoryModel }> = ({ repository }) => {
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
        {workflows.map((w) => (
          <WorkflowOverviewCard key={w.id} workflow={w} />
        ))}
      </div>
    </div>
  );
};
