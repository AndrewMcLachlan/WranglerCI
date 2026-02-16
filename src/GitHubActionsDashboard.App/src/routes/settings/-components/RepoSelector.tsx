import { NavItemList, type NavItem } from "@andrewmclachlan/moo-ds";
import type { AccountModel, SettingsRepositoryModel } from "../../../api";
import { useState } from "react";
import { WorkflowSelector } from "./WorkflowSelector";

export const RepoSelector: React.FC<React.PropsWithChildren<RepoSelectorProps>> = ({ account }) => {

    const [selectedRepo, setSelectedRepo] = useState<SettingsRepositoryModel | undefined>(undefined);

    const navList: NavItem[] = account.repositories?.map(repo => ({ id: repo.name, text: repo.name, onClick: () => { }, disabled: repo?.workflows?.length === 0 })) || [];

    return (
        <>
            <div className="sidebar">
                <div className="flex-column nav">
                    <NavItemList navItems={navList} onClick={(_e, navItem) => setSelectedRepo(account?.repositories?.find(r => r.name === navItem.id))} />
                </div>
            </div>
            <div className="section-content">
                {selectedRepo && (
                    <WorkflowSelector repository={selectedRepo } />
                )}
            </div>
        </>
    );
}

export interface RepoSelectorProps {
    account: AccountModel;
}
