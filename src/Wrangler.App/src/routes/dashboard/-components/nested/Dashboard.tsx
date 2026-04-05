import { RepositoryList } from "./RepositoryList";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { Spinner } from "../../../../components/Spinner";

export const Dashboard = () => {

  const { data: repositories, isLoading, isError, error } = useWorkflows();

  if (isError) {
    console.error("Error fetching dashboard data:", error);
    return <p>Error loading build info.</p>;
  }

  return (
    <>
      {isLoading && <Spinner />}
      {(!isLoading && (!repositories || repositories.length === 0)) && <p>No workflows found.</p>}
      {repositories && <RepositoryList repositories={repositories} />}
    </>
  );
}
