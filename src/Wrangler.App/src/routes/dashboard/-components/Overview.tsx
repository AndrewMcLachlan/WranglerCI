import { useState } from "react";
import { Icon } from "@andrewmclachlan/moo-ds";
import { DateTime } from "luxon";
import type { RepositoryModel, WorkflowModel, WorkflowRunModel, WorkflowStatus } from "../../../api";
import { useWorkflows } from "../-hooks/useWorkflows";
import { Spinner } from "../../../components/Spinner";
import StatusIndicator from "./StatusIndicator";
import { Badge } from "./Badge";


const statusPriority: Record<string, number> = {
  Red: 0,
  Amber: 1,
  Waiting: 2,
  Running: 3,
  None: 4,
  Green: 5,
};

const sortByStatus = (a: { overallStatus?: WorkflowStatus }, b: { overallStatus?: WorkflowStatus }) =>
  (statusPriority[a.overallStatus ?? "None"] ?? 4) - (statusPriority[b.overallStatus ?? "None"] ?? 4);

const latestRun = (workflow: WorkflowModel): WorkflowRunModel | undefined =>
  workflow.runs?.[0];

const isAttentionNeeded = (workflow: WorkflowModel): boolean => {
  const status = workflow.overallStatus;
  return status === "Red" || status === "Amber";
};

const WorkflowRow: React.FC<{ workflow: WorkflowModel }> = ({ workflow }) => {
  const run = latestRun(workflow);
  const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });
  const timeAgo = run
    ? DateTime.fromISO(run.updatedAt).toRelative({ style: "long" }) || formatter.format(0, "seconds")
    : undefined;

  return (
    <div className="workflow-row">
      <StatusIndicator status={workflow.overallStatus} />
      <a className="workflow-name" href={workflow.htmlUrl?.replace("blob/main/.github", "actions")} target="_blank" rel="noopener noreferrer">{workflow.name}</a>
      {run && <a className="workflow-run-info" href={run.htmlUrl} target="_blank" rel="noopener noreferrer">
        <Badge className="branch">{run.headBranch}</Badge>
        {timeAgo && (
          <span className="workflow-time" title={DateTime.fromISO(run.updatedAt).toFormat("yyyy-MM-dd HH:mm:ss")}>
            {timeAgo}
          </span>
        )}
      </a>}
    </div>
  );
};

const RepositoryOverviewCard: React.FC<{ repository: RepositoryModel }> = ({ repository }) => {
  const [expanded, setExpanded] = useState(false);
  const workflows = [...(repository.workflows ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const attentionWorkflows = workflows.filter(isAttentionNeeded);
  const passingWorkflows = workflows.filter((w) => !isAttentionNeeded(w));
  const hasCollapsible = attentionWorkflows.length > 0 && passingWorkflows.length > 0;

  return (
    <div className="overview-card">
      <div className="overview-card-header">
        <StatusIndicator status={repository.overallStatus} />
        <h3>{repository.name}</h3>
        <a href={`${repository.htmlUrl}/actions`} target="_blank" rel="noopener noreferrer">
          <Icon icon="arrow-up-right-from-square" />
        </a>
      </div>
      <div className="overview-card-body">
        {attentionWorkflows.map((w) => (
          <WorkflowRow key={w.id} workflow={w} />
        ))}
        {hasCollapsible && !expanded && (
          <button className="passing-summary" onClick={() => setExpanded(true)}>
            +{passingWorkflows.length} passing
          </button>
        )}
        {(!hasCollapsible || expanded) &&
          passingWorkflows.map((w) => (
            <WorkflowRow key={w.id} workflow={w} />
          ))
        }
      </div>
    </div>
  );
};

const WorkflowOverviewCard: React.FC<{ workflow: WorkflowModel }> = ({ workflow }) => {
  const run = latestRun(workflow);
  const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });
  const timeAgo = run
    ? DateTime.fromISO(run.updatedAt).toRelative({ style: "long" }) || formatter.format(0, "seconds")
    : undefined;

  return (
    <div className="overview-card">
      <a className="overview-card-header" href={workflow.htmlUrl?.replace("blob/main/.github", "actions")} target="_blank" rel="noopener noreferrer">
        <StatusIndicator status={workflow.overallStatus} />
        <h3>{workflow.name}</h3>
      </a>
      {run && (
        <a className="overview-card-body" href={run.htmlUrl} target="_blank" rel="noopener noreferrer">
          <Badge className="branch">{run.headBranch}</Badge>
          <span className="workflow-time" title={DateTime.fromISO(run.updatedAt).toFormat("yyyy-MM-dd HH:mm:ss")}>
            {timeAgo}
          </span>
        </a>
      )}
    </div>
  );
};

const RepositoryWorkflowsExpanded: React.FC<{ repository: RepositoryModel }> = ({ repository }) => {
  const workflows = [...(repository.workflows ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="repo-expanded">
      <div className="repo-header-bar">
        <StatusIndicator status={repository.overallStatus} />
        <h3>{repository.name}</h3>
        <a href={`${repository.htmlUrl}/actions`} target="_blank" rel="noopener noreferrer">
          <Icon icon="arrow-up-right-from-square" />
        </a>
      </div>
      <div className="repo-expanded-grid">
        {workflows.map((w) => (
          <WorkflowOverviewCard key={w.id} workflow={w} />
        ))}
      </div>
    </div>
  );
};

const ExpandedWorkflowThreshold = 5;

const AccountSection: React.FC<{ owner: string; repositories: RepositoryModel[] }> = ({ owner, repositories }) => {
  return (
    <section className="account-section">
      <div className="account-section-header">
        <h2>{owner}</h2>
      </div>
      <div className="account-section-body">
        {repositories.map((repo) =>
          (repo.workflows?.length ?? 0) > ExpandedWorkflowThreshold ? (
            <RepositoryWorkflowsExpanded key={repo.nodeId} repository={repo} />
          ) : (
            <RepositoryOverviewCard key={repo.nodeId} repository={repo} />
          )
        )}
      </div>
    </section>
  );
};

const worstStatus = (repositories: RepositoryModel[]): WorkflowStatus =>
  repositories.reduce<WorkflowStatus>((worst, repo) => {
    const repoPriority = statusPriority[repo.overallStatus ?? "None"] ?? 4;
    const worstPriority = statusPriority[worst] ?? 4;
    return repoPriority < worstPriority ? (repo.overallStatus ?? "None") : worst;
  }, "None");

export const Overview = () => {
  const { data: repositories, isLoading, isError, error } = useWorkflows();

  if (isError) {
    console.error("Error fetching dashboard data:", error);
    return <p>Error loading build info.</p>;
  }

  const sorted = [...(repositories ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const grouped = sorted.reduce<Record<string, RepositoryModel[]>>((acc, repo) => {
    (acc[repo.owner] ??= []).push(repo);
    return acc;
  }, {});
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="overview">
      {isLoading && <Spinner />}
      {!isLoading && (!repositories || repositories.length === 0) && <p>No workflows found.</p>}
      {sortedGroups.map(([owner, repos]) => (
        <AccountSection key={owner} owner={owner} repositories={repos} />
      ))}
    </div>
  );
};
