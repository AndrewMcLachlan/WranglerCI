import type { RepositoryModel } from "../../../../api";
import { repositoryKey, type PendingWorkflow } from "../../-hooks/useWorkflows";
import { RepositoryCard } from "./RepositoryCard";

export const RepositoryList: React.FC<RepositoryListProps> = ({ repositories, pendingWorkflows }) => {

  return (
    <section className="repository-list">
      {repositories?.length === 0 ? (
        <p>No repositories found.</p>
      ) : repositories?.map((repository) => (
        <RepositoryCard key={`${repository.owner}|${repository.name}`} repository={repository} pendingWorkflows={pendingWorkflows?.get(repositoryKey(repository))} />
      ))}
    </section>
  );
}
export interface RepositoryListProps {
  repositories: RepositoryModel[]
  pendingWorkflows?: Map<string, PendingWorkflow[]>
}
