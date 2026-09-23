import type { RepositoryModel } from "../../../../api";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { Spinner } from "../../../../components/Spinner";
import { AccountSection } from "./AccountSection";

export const Overview = () => {
  const { data: repositories, isLoading, isError, error } = useWorkflows();

  if (isError) {
    console.error("Error fetching dashboard data:", error);
    return <p>Error loading build info.</p>;
  }

  const showSpinner = isLoading && !repositories;

  const sorted = [...(repositories ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const grouped = sorted.reduce<Record<string, RepositoryModel[]>>((acc, repo) => {
    (acc[repo.owner] ??= []).push(repo);
    return acc;
  }, {});
  // Grouped by login, which is what identifies an account; headed by the
  // display name, which is what people call it.
  const sortedGroups = Object.entries(grouped)
    .map(([owner, repos]) => ({ owner, title: repos[0].ownerName || owner, repos }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="overview">
      {showSpinner && <Spinner />}
      {!showSpinner && (!repositories || repositories.length === 0) && <p>No workflows found.</p>}
      {sortedGroups.map(({ owner, title, repos }) => (
        <AccountSection key={owner} owner={title} repositories={repos} />
      ))}
    </div>
  );
};
