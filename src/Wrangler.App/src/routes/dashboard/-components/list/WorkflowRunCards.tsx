import { Badge } from "@andrewmclachlan/moo-ds";
import { DateTime } from "luxon";
import { RowCard } from "../../../../components/RowCard";
import { BranchBadge } from "../shared/BranchBadge";
import type { RepositoryModel, WorkflowModel, WorkflowRunModel } from "../../../../api";

export interface WorkflowRunItem {
  repo: RepositoryModel;
  workflow: WorkflowModel;
  run: WorkflowRunModel;
}

interface WorkflowRunCardsProps {
  items: WorkflowRunItem[];
  loading: boolean;
  emptyMessage: string;
}

/** The narrow-viewport rendering of the dashboard's run list. */
export const WorkflowRunCards: React.FC<WorkflowRunCardsProps> = ({ items, loading, emptyMessage }) => {
  if (loading) return <p className="row-card-message">Loading...</p>;
  if (items.length === 0) return <p className="row-card-message">{emptyMessage}</p>;

  return (
    <div className="row-card-list">
      {items.map(({ repo, workflow, run }) => {
        const updatedAt = run.updatedAt ? DateTime.fromISO(run.updatedAt) : undefined;

        return (
          <RowCard
            key={run.id}
            title={<a href={run.htmlUrl} target="_blank" rel="noopener noreferrer">{workflow.name}</a>}
            meta={
              <>
                <Badge className={run.workflowStatus?.toLowerCase()}>{run.conclusion || run.status}</Badge>
                <BranchBadge run={run} />
              </>
            }
            details={[
              { label: "Repository", value: repo.name },
              { label: "Updated", value: updatedAt?.toRelative({ style: "long" }) ?? "—" },
            ]}
          />
        );
      })}
    </div>
  );
};
