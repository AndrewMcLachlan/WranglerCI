import type { RepositoryModel } from "../../../../api";
import type { SelectedRepository } from "../../../settings/-hooks/repositoryFeatures";
import { repositoryKey } from "../../-hooks/useWorkflows";
import { PlaceholderCard } from "../shared/Placeholder";
import { RepositoryOverviewCard } from "./RepositoryOverviewCard";
import { RepositoryWorkflowsExpanded } from "./RepositoryWorkflowsExpanded";

const ExpandedWorkflowThreshold = 5;

export const AccountSection: React.FC<{ owner: string; repositories: RepositoryModel[]; loading?: SelectedRepository[]; pendingWorkflows: Map<string, number> }> = ({ owner, repositories, loading = [], pendingWorkflows }) => {
  const items = [
    ...repositories.map((repo) => ({ name: repo.name, repo })),
    ...loading.map((repo) => ({ name: repo.name, repo: undefined })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="account-section">
      <div className="account-section-header">
        <h2>{owner}</h2>
      </div>
      <div className="account-section-body">
        {items.map(({ name, repo }) => {
          if (!repo) return <PlaceholderCard key={`loading:${name}`} title={name} label={`Loading ${name}`} />;
          const pending = pendingWorkflows.get(repositoryKey(repo)) ?? 0;
          return (repo.workflows?.length ?? 0) + pending > ExpandedWorkflowThreshold
            ? <RepositoryWorkflowsExpanded key={repo.nodeId} repository={repo} pendingWorkflows={pending} />
            : <RepositoryOverviewCard key={repo.nodeId} repository={repo} pendingWorkflows={pending} />;
        })}
      </div>
    </section>
  );
};
