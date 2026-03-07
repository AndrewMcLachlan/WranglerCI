import { ComboBox } from "@andrewmclachlan/moo-ds";
import { useRepositories } from "../../../hooks/useRepositories";

export const RepositorySelector = () => {
  const { data: repositories, isLoading } = useRepositories();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <ComboBox labelField={f => f.name} valueField={f => f.id} placeholder="Select a repository" items={repositories || []} className="repository-selector" />
  );
}
