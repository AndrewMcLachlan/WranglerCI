import type { RepositoryModel } from "../../../../api";
import type { SelectedRepository } from "../../../settings/-hooks/repositoryFeatures";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { AccountSection } from "./AccountSection";
import { RefreshFailed } from "../shared/RefreshFailed";

interface AccountGroup {
  owner: string;
  title: string;
  repos: RepositoryModel[];
  loading: SelectedRepository[];
}

export const Overview = () => {
  const { data: repositories, loading, pendingWorkflows, isLoading, isError, error } = useWorkflows();

  if (isError && repositories.length === 0 && loading.length === 0) {
    console.error("Error fetching dashboard data:", error);
    return <p>Error loading build info.</p>;
  }

  // Grouped by login, which is what identifies an account; headed by the
  // display name, which is what people call it.
  const groups = new Map<string, AccountGroup>();
  const groupFor = (owner: string) => {
    const key = owner.toLowerCase();
    let group = groups.get(key);
    if (!group) groups.set(key, group = { owner, title: owner, repos: [], loading: [] });
    return group;
  };
  for (const repo of repositories) {
    const group = groupFor(repo.owner);
    group.repos.push(repo);
    group.title = repo.ownerName || repo.owner;
  }
  for (const repo of loading) groupFor(repo.owner).loading.push(repo);

  const sortedGroups = [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="overview">
      {isError && <RefreshFailed />}
      {!isLoading && repositories.length === 0 && <p>No workflows found.</p>}
      {sortedGroups.map(({ owner, title, repos, loading }) => (
        <AccountSection key={owner} owner={title} repositories={repos} loading={loading} pendingWorkflows={pendingWorkflows} />
      ))}
    </div>
  );
};
