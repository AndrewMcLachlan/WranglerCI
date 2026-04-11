import type { RepositoryModel } from "../../../../api";
import { RepositoryCard } from "./RepositoryCard";

export const RepositoryList: React.FC<RepositoryListProps> = ({ repositories }) => {

  return (
    <section className="repository-list">
      {repositories?.length === 0 ? (
        <p>No repositories found.</p>
      ) : repositories?.map((repository) => (
        <RepositoryCard key={`${repository.owner}|${repository.name}`} repository={repository} />
      ))}
    </section>
  );
}
export interface RepositoryListProps {
  repositories: RepositoryModel[]
}
