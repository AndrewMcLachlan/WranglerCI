import { Icon } from "@andrewmclachlan/moo-ds";
import type { RepositoryModel } from "../../../../api";
import type { PendingWorkflow } from "../../-hooks/useWorkflows";
import { Collapsible } from "../shared/Collapsible";
import StatusIndicator from "../shared/StatusIndicator";
import { WorkflowList } from "./WorkflowList";

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repository, pendingWorkflows }) => {
  return (
    <Collapsible className="repository-card" header={
      <>
        <StatusIndicator status={repository.overallStatus} />
        <h3>{repository.owner} {repository.name}</h3>
        <span><a href={`${repository.htmlUrl}/actions`} target="_blank"><Icon icon="arrow-up-right-from-square" /></a></span>
      </>
    }>
      <WorkflowList workflows={repository.workflows} pendingWorkflows={pendingWorkflows} />
    </Collapsible>
  );
}

export interface RepositoryCardProps {
  repository: RepositoryModel
  pendingWorkflows?: PendingWorkflow[]
}
