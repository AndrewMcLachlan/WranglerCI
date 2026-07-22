import { Nav } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { AccountModel, SettingsRepositoryModel } from "../../../api";
import { useState } from "react";
import { RepoFeatures } from "./RepoFeatures";
import { useSelectedRepositories } from "../-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../-hooks/repositoryFeatures";

export const RepoSelector: React.FC<React.PropsWithChildren<RepoSelectorProps>> = ({ account }) => {

  // Every repo is selectable — a repo without workflows can still be opted
  // into Pull Requests or Security Alerts.
  const [selectedRepo, setSelectedRepo] = useState<SettingsRepositoryModel | undefined>(account.repositories?.[0]);
  const { data: selectedRepositories } = useSelectedRepositories();

  return (
    <>
      <div className="sidebar">
        <Nav>
          {account.repositories?.map(repo => {
            const entry = selectedRepositories.find(r => r.owner === repo.owner && r.name === repo.name);
            return (
              <Nav.Link
                key={repo.name}
                active={selectedRepo?.name === repo.name}
                onClick={() => setSelectedRepo(repo)}
              >
                <span className="repo-name">{repo.name}</span>
                <span className="repo-feature-icons">
                  {entry && hasDashboardWorkflows(entry) && <FontAwesomeIcon icon="gauge" title="On dashboard" />}
                  {entry?.pullRequests === true && <FontAwesomeIcon icon="code-pull-request" title="Pull requests" />}
                  {entry?.securityAlerts === true && <FontAwesomeIcon icon="shield-halved" title="Security alerts" />}
                </span>
              </Nav.Link>
            );
          })}
        </Nav>
      </div>
      <div className="section-content">
        {selectedRepo && (
          <RepoFeatures repository={selectedRepo} />
        )}
      </div>
    </>
  );
}

export interface RepoSelectorProps {
  account: AccountModel;
}
