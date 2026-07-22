import { useSelectedRepositories, useUpdateSelectedRepositories, type SelectedRepository } from "../-hooks/useSelectedRepositories";
import { upsertRepository } from "../-hooks/repositoryFeatures";
import type { SettingsRepositoryModel, WorkflowBase } from "../../../api";
import { useMemo } from "react";

export const RepoFeatures: React.FC<React.PropsWithChildren<RepoFeaturesProps>> = ({ repository }) => {

  const { data: repositories } = useSelectedRepositories();

  const repositoryEntry = useMemo(() =>
    repositories?.find(r => r.owner === repository.owner && r.name === repository.name) ?? { owner: repository.owner, name: repository.name, workflows: [] } as SelectedRepository,
    [repositories, repository]);

  const { mutate } = useUpdateSelectedRepositories();

  // upsertRepository builds fresh entries rather than mutating repositoryEntry
  // in place: it may be a reference into the react-query cache, and mutating it
  // corrupts that cache and defeats referential-equality change detection.
  const commit = (patch: Partial<Omit<SelectedRepository, "owner" | "name">>) => {
    mutate(upsertRepository(repositories, repositoryEntry.owner, repositoryEntry.name, patch));
  };

  const workflows = repositoryEntry.workflows ?? [];

  const handleWorkflowsChange = (workflow: WorkflowBase) => {
    commit({
      workflows: workflows.some(wf => wf === workflow.id!) ?
        workflows.filter(wf => wf !== workflow.id!) :
        [...workflows, workflow.id!],
    });
  }

  const selectAll = () => {
    commit({ workflows: repository.workflows?.map(wf => wf.id!) ?? [] });
  };

  const clear = () => {
    commit({ workflows: [] });
  };

  const hasWorkflows = (repository.workflows?.length ?? 0) > 0;

  return (
    <div className="repo-features">
      <h3>Features</h3>
      <ul className="feature-switches">
        <li className="form-check form-switch">
          <input id="feature-pull-requests" type="checkbox" className="form-check-input" checked={repositoryEntry.pullRequests === true} onChange={() => commit({ pullRequests: repositoryEntry.pullRequests !== true })} />
          <label htmlFor="feature-pull-requests" className="form-check-label">Pull Requests</label>
        </li>
        <li className="form-check form-switch">
          <input id="feature-security-alerts" type="checkbox" className="form-check-input" checked={repositoryEntry.securityAlerts === true} onChange={() => commit({ securityAlerts: repositoryEntry.securityAlerts !== true })} />
          <label htmlFor="feature-security-alerts" className="form-check-label">Security Alerts</label>
        </li>
      </ul>
      <h3>Dashboard Workflows</h3>
      {hasWorkflows ? (
        <>
          <div><button className="btn btn-link" onClick={selectAll}>Select All</button> <button className="btn btn-link" onClick={clear}>Clear</button></div>
          <ul>
            {repository.workflows?.map(workflow => (
              <li key={workflow.id} className="form-check form-switch">
                <input id={workflow.id?.toString()} type="checkbox" className="form-check-input" checked={workflows.some(wf => wf === workflow.id)} onChange={() => handleWorkflowsChange(workflow)} />
                <label htmlFor={workflow.id?.toString()} className="form-check-label">{workflow.name}</label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="no-workflows">No GitHub Actions workflows in this repository.</p>
      )}
    </div>
  );
}

export interface RepoFeaturesProps {
  repository: SettingsRepositoryModel;
}
