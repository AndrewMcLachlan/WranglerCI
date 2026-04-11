import type { RepositoryModel } from "../../../../api";
import { RepositoryOverviewCard } from "./RepositoryOverviewCard";
import { RepositoryWorkflowsExpanded } from "./RepositoryWorkflowsExpanded";

const ExpandedWorkflowThreshold = 5;

export const AccountSection: React.FC<{ owner: string; repositories: RepositoryModel[] }> = ({ owner, repositories }) => {
  return (
    <section className="account-section">
      <div className="account-section-header">
        <h2>{owner}</h2>
      </div>
      <div className="account-section-body">
        {repositories.map((repo) =>
          (repo.workflows?.length ?? 0) > ExpandedWorkflowThreshold ? (
            <RepositoryWorkflowsExpanded key={repo.nodeId} repository={repo} />
          ) : (
            <RepositoryOverviewCard key={repo.nodeId} repository={repo} />
          )
        )}
      </div>
    </section>
  );
};
