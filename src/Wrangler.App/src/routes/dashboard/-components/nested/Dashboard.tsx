import { RepositoryList } from "./RepositoryList";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { Spinner } from "../../../../components/Spinner";
import { RefreshFailed } from "../shared/RefreshFailed";

export const Dashboard = () => {

  const { data: repositories, isLoading, isError, error } = useWorkflows();

  if (isError && !repositories) {
    console.error("Error fetching dashboard data:", error);
    return <p>Error loading build info.</p>;
  }

  const showSpinner = isLoading && !repositories;

  return (
    <>
      {isError && <RefreshFailed />}
      {showSpinner && <Spinner />}
      {(!showSpinner && (!repositories || repositories.length === 0)) && <p>No workflows found.</p>}
      {repositories && <RepositoryList repositories={repositories} />}
    </>
  );
}
