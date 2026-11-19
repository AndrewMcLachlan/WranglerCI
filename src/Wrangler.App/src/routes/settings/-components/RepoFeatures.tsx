import { useSelectedRepositories, useUpdateSelectedRepositories, type SelectedRepository } from "../-hooks/useSelectedRepositories";
import { upsertRepository } from "../-hooks/repositoryFeatures";
import { selectedCount, setWorkflows, visibleWorkflows } from "../-hooks/settingsLists";
import { ClearableInput, Input } from "@andrewmclachlan/moo-ds";
import type { SettingsRepositoryModel, WorkflowBase } from "../../../api";
import { useMemo, useState } from "react";

export const RepoFeatures: React.FC<React.PropsWithChildren<RepoFeaturesProps>> = ({ repository, back }) => {

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

  const [filter, setFilter] = useState("");

  const allWorkflows = repository.workflows ?? [];
  const hasWorkflows = allWorkflows.length > 0;
  const shown = visibleWorkflows(allWorkflows, filter);

  return (
    <div className="repo-features">
      <div className="repo-title">
        {back}
        <h3>{repository.name}</h3>
      </div>
      <ul className="feature-switches">
        <li><Input.Switch id="feature-pull-requests" label="Pull requests" checked={repositoryEntry.pullRequests === true} onChange={() => commit({ pullRequests: repositoryEntry.pullRequests !== true })} /></li>
        <li><Input.Switch id="feature-security-alerts" label="Security alerts" checked={repositoryEntry.securityAlerts === true} onChange={() => commit({ securityAlerts: repositoryEntry.securityAlerts !== true })} /></li>
      </ul>
      <h4>Dashboard workflows</h4>
      {hasWorkflows ? (
        <>
          <div className="workflow-toolbar">
            <ClearableInput className="form-control" aria-label="Filter workflows" clearable placeholder="Filter workflows…" value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          <div className="workflow-count">
            <span>{selectedCount(allWorkflows, workflows)} of {allWorkflows.length} on dashboard</span>
            <button type="button" className="btn btn-link" onClick={() => commit({ workflows: setWorkflows(workflows, shown, true) })}>Select shown</button>
            <button type="button" className="btn btn-link" onClick={() => commit({ workflows: setWorkflows(workflows, shown, false) })}>Clear shown</button>
          </div>
          {shown.length > 0 ? (
            <ul className="workflow-switches">
              {shown.map(workflow => (
                <li key={workflow.id}>
                  <Input.Switch id={workflow.id?.toString()} label={workflow.name} checked={workflows.some(wf => wf === workflow.id)} onChange={() => handleWorkflowsChange(workflow)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-workflows">No workflows match.</p>
          )}
        </>
      ) : (
        <p className="no-workflows">No GitHub Actions workflows in this repository.</p>
      )}
    </div>
  );
}

export interface RepoFeaturesProps {
  repository: SettingsRepositoryModel;
  back?: React.ReactNode;
}
