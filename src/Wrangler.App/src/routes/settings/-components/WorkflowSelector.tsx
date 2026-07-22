import { useSelectedRepositories, useUpdateSelectedRepositories, type SelectedRepository } from "../-hooks/useSelectedRepositories";
import type { SettingsRepositoryModel, WorkflowBase } from "../../../api";
import { useMemo } from "react";

export const WorkflowSelector: React.FC<React.PropsWithChildren<WorkflowSelectorProps>> = ({ repository }) => {

  const { data: repositories } = useSelectedRepositories();

  const repositoryEntry = useMemo(() =>
    repositories?.find(r => r.owner === repository.owner && r.name === repository.name) ?? { owner: repository.owner, name: repository.name, workflows: [] } as SelectedRepository,
    [repositories, repository]);

  const { mutate } = useUpdateSelectedRepositories();

  // Build a fresh entry rather than mutating repositoryEntry in place: it may be
  // a reference into the react-query cache, and mutating it corrupts that cache
  // and defeats the referential-equality checks that detect the change.
  const commit = (workflows: (number | string)[]) => {
    const newRepos = repositories.filter(r => !(r.owner === repository.owner && r.name === repository.name));
    mutate([...newRepos, { ...repositoryEntry, workflows }]);
  };

  const handleWorkflowsChange = (workflow: WorkflowBase) => {
    const workflows = repositoryEntry.workflows ?? [];
    commit(workflows.some(wf => wf === workflow.id!) ?
      workflows.filter(wf => wf !== workflow.id!) :
      [...workflows, workflow.id!]);
  }

  const selectAll = () => {
    commit(repository.workflows?.map(wf => wf.id!) ?? []);
  };

  const clear = () => {
    commit([]);
  };

  return (
    <div className="workflow-selector">
      <h3>Workflows</h3>
      <div><button className="btn btn-link" onClick={selectAll}>Select All</button> <button className="btn btn-link" onClick={clear}>Clear</button></div>
      <ul>
        {repository.workflows?.map(workflow => (
          <li key={workflow.id} className="form-check form-switch">
            <input id={workflow.id?.toString()} type="checkbox" className="form-check-input" checked={repositoryEntry.workflows?.some(wf => wf === workflow.id) ?? false} onChange={() => handleWorkflowsChange(workflow)} />
            <label htmlFor={workflow.id?.toString()} className="form-check-label">{workflow.name}</label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface WorkflowSelectorProps {
  repository: SettingsRepositoryModel;
}
