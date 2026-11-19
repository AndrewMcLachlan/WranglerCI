import { ClearableInput, Nav, useIsAtLeast } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import type { AccountModel, SettingsRepositoryModel } from "../../../api";
import { useEffect, useRef, useState } from "react";
import { RepoFeatures } from "./RepoFeatures";
import { useSelectedRepositories } from "../-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../-hooks/repositoryFeatures";
import { defaultRepository, groupRepositories } from "../-hooks/settingsLists";

export const RepoSelector: React.FC<React.PropsWithChildren<RepoSelectorProps>> = ({ account }) => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const repositories = account.repositories ?? [];
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(() => {
    const initial = defaultRepository(repositories, selectedRepositories);
    return initial ? repoKey(initial) : undefined;
  });
  const [showingDetail, setShowingDetail] = useState(false);
  const narrow = !useIsAtLeast("md");
  const bodyRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const linksRef = useRef(new Map<string, HTMLElement>());
  const previousShowingRef = useRef(false);

  const selectedRepo = repositories.find(r => repoKey(r) === selectedKey) ?? defaultRepository(repositories, selectedRepositories);
  const activeKey = selectedRepo ? repoKey(selectedRepo) : undefined;

  useEffect(() => {
    if (previousShowingRef.current === showingDetail) return;
    previousShowingRef.current = showingDetail;
    if (!narrow) return;
    if (showingDetail) {
      detailRef.current?.scrollIntoView({ block: "start" });
      backRef.current?.focus({ preventScroll: true });
    } else {
      (linksRef.current.get(activeKey ?? "") ?? bodyRef.current?.querySelector("input"))?.focus();
    }
  }, [showingDetail, narrow, activeKey]);

  const { inUse, others } = groupRepositories(repositories, selectedRepositories, search);

  const select = (repo: SettingsRepositoryModel) => {
    setSelectedKey(repoKey(repo));
    setShowingDetail(true);
  };

  const renderRepo = (repo: SettingsRepositoryModel) => {
    const entry = selectedRepositories.find(r => r.owner === repo.owner && r.name === repo.name);
    return (
      <Nav.Link
        key={repoKey(repo)}
        ref={el => { if (el) linksRef.current.set(repoKey(repo), el); else linksRef.current.delete(repoKey(repo)); }}
        as="button"
        {...{ type: "button" }}
        active={repoKey(repo) === activeKey}
        onClick={() => select(repo)}
      >
        <span className="repo-name">{repo.name}</span>
        <span className="repo-feature-icons">
          {entry && hasDashboardWorkflows(entry) && <FontAwesomeIcon icon="gauge" title="On dashboard" />}
          {entry?.pullRequests === true && <FontAwesomeIcon icon="code-pull-request" title="Pull requests" />}
          {entry?.securityAlerts === true && <FontAwesomeIcon icon="shield-halved" title="Security alerts" />}
        </span>
      </Nav.Link>
    );
  };

  return (
    <div ref={bodyRef} className={classNames("repo-selector-body", { "showing-detail": showingDetail })}>
      <div className="sidebar">
        {repositories.length === 0 ? (
          <p className="no-matches">No repositories</p>
        ) : (
          <>
            <ClearableInput
              className="form-control"
              aria-label="Search repos"
              clearable
              placeholder={`Search ${repositories.length} repositories`}
              value={search}
              onChange={e => setSearch(e.currentTarget.value)}
            />
            {inUse.length === 0 && others.length === 0 && <p className="no-matches">No repos match "{search.trim()}"</p>}
            {inUse.length > 0 && (
              <>
                <h3 className="repo-group">In use</h3>
                <Nav>{inUse.map(renderRepo)}</Nav>
              </>
            )}
            {others.length > 0 && (
              <>
                <h3 className="repo-group">All repos</h3>
                <Nav>{others.map(renderRepo)}</Nav>
              </>
            )}
          </>
        )}
      </div>
      <div ref={detailRef} className="section-content">
        {selectedRepo && (
          <RepoFeatures
            key={activeKey}
            repository={selectedRepo}
            back={<button ref={backRef} type="button" className="repo-back" aria-label="All repos" title="All repos" onClick={() => setShowingDetail(false)}><FontAwesomeIcon icon="chevron-left" /></button>}
          />
        )}
      </div>
    </div>
  );
}

const repoKey = (repo: SettingsRepositoryModel) => `${repo.owner}/${repo.name}`;

export interface RepoSelectorProps {
  account: AccountModel;
}
