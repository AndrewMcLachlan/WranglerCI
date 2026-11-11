import type { RepositoryModel } from "../../../../api";
import type { SelectedRepository } from "../../../settings/-hooks/repositoryFeatures";
import { RepositoryPlaceholder } from "../shared/RepositoryPlaceholder";
import { RepositoryOverviewCard } from "./RepositoryOverviewCard";
import { RepositoryWorkflowsExpanded } from "./RepositoryWorkflowsExpanded";

const ExpandedWorkflowThreshold = 5;

export const AccountSection: React.FC<{ owner: string; repositories: RepositoryModel[]; loading?: SelectedRepository[] }> = ({ owner, repositories, loading = [] }) => {
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
        {items.map(({ name, repo }) =>
          !repo ? (
            <RepositoryPlaceholder key={`loading:${name}`} name={name} />
          ) : (repo.workflows?.length ?? 0) > ExpandedWorkflowThreshold ? (
            <RepositoryWorkflowsExpanded key={repo.nodeId} repository={repo} />
          ) : (
            <RepositoryOverviewCard key={repo.nodeId} repository={repo} />
          )
        )}
      </div>
    </section>
  );
};
