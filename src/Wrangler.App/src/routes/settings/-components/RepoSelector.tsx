import { Nav } from "@andrewmclachlan/moo-ds";
import type { AccountModel, SettingsRepositoryModel } from "../../../api";
import { useState } from "react";
import { WorkflowSelector } from "./WorkflowSelector";

export const RepoSelector: React.FC<React.PropsWithChildren<RepoSelectorProps>> = ({ account }) => {

  const firstAvailable = account.repositories?.find(r => (r.workflows?.length ?? 0) > 0);
  const [selectedRepo, setSelectedRepo] = useState<SettingsRepositoryModel | undefined>(firstAvailable);

  return (
    <>
      <div className="sidebar">
        <Nav>
          {account.repositories?.map(repo => {
            const disabled = (repo.workflows?.length ?? 0) === 0;
            return (
              <Nav.Link
                key={repo.name}
                active={selectedRepo?.name === repo.name}
                disabled={disabled}
                onClick={() => !disabled && setSelectedRepo(repo)}
              >
                {repo.name}
              </Nav.Link>
            );
          })}
        </Nav>
      </div>
      <div className="section-content">
        {selectedRepo && (
          <WorkflowSelector repository={selectedRepo} />
        )}
      </div>
    </>
  );
}

export interface RepoSelectorProps {
  account: AccountModel;
}
