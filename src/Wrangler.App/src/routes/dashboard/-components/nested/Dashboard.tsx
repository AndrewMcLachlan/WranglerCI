import { RepositoryList } from "./RepositoryList";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { RefreshFailed } from "../shared/RefreshFailed";
import { RepositoryPlaceholder } from "../shared/RepositoryPlaceholder";

export const Dashboard = () => {

  const { data: repositories, loading, isLoading, isError, error } = useWorkflows();

  if (isError && repositories.length === 0 && loading.length === 0) {
    console.error("Error fetching dashboard data:", error);
    return <p>Error loading build info.</p>;
  }

  return (
    <>
      {isError && <RefreshFailed />}
      {!isLoading && repositories.length === 0 && <p>No workflows found.</p>}
      {repositories.length > 0 && <RepositoryList repositories={repositories} />}
      {loading.length > 0 && (
        <section className="repository-list">
          {loading.map((repo) => <RepositoryPlaceholder key={`${repo.owner}|${repo.name}`} name={`${repo.owner} ${repo.name}`} />)}
        </section>
      )}
    </>
  );
}
