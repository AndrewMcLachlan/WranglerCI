import { Badge, CopyText } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DateTime } from "luxon";
import type { CheckStatus, PullRequestModel } from "../../../api";
import { MergeBlockerBadges, unresolvedCount } from "./MergeBlockerBadges";
import { canMerge, prState } from "./prState";

const relative = (iso: string) => DateTime.fromISO(iso).toRelative({ style: "long" }) ?? "just now";
const exact = (iso: string) => DateTime.fromISO(iso).toFormat("yyyy-MM-dd HH:mm:ss");

export const PullRequestLabels: React.FC<{ pullRequest: PullRequestModel }> = ({ pullRequest: pr }) =>
  pr.labels?.map((label) => (
    <Badge key={label.name} className="pr-label" pill muted colour={`#${label.color}`}>{label.name}</Badge>
  ));

/** Where the pull request lives: repository, number, branch and (optionally) labels. Also marks the row/card with its state for the coloured edge. */
export const PullRequestContext: React.FC<{ pullRequest: PullRequestModel; labels?: boolean }> = ({ pullRequest: pr, labels = true }) => (
  <div className="pr-context">
    <span className="pr-state" data-state={prState(pr)} hidden />
    <span><span className="pr-owner">{pr.repositoryOwner} /</span> {pr.repositoryName} <CopyText className="pr-number" text={`#${pr.number}`} /></span>
    <Badge className="branch" icon={<FontAwesomeIcon icon="code-branch" />} title={pr.headRef}><span className="pr-branch-name">{pr.headRef}</span></Badge>
    {labels && <PullRequestLabels pullRequest={pr} />}
  </div>
);

export const PullRequestCell: React.FC<{ pullRequest: PullRequestModel }> = ({ pullRequest: pr }) => (
  <div className="pr-cell">
    <a className="pr-title" href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">{pr.title}</a>
    <PullRequestContext pullRequest={pr} />
  </div>
);

const ReadyBadge: React.FC<{ long: boolean }> = ({ long }) => <Badge className="green" icon={<FontAwesomeIcon icon="circle-check" />} title="Nothing blocks the merge">{long ? "Ready to merge" : "Ready"}</Badge>;

const waitingOnChecks: Partial<Record<CheckStatus, string>> = {
  Pending: "Waiting on checks",
  Failure: "Blocked by checks",
};

const AutoMergeBadge: React.FC = () => <Badge className="auto-merge" icon={<FontAwesomeIcon icon="code-merge" />} title="GitHub will merge this once nothing blocks it">Auto-merge</Badge>;

/** `long` labels the Ready badge as being about merging, for places without a "Merge" column header. */
export const MergeCell: React.FC<{ pullRequest: PullRequestModel; long?: boolean }> = ({ pullRequest, long }) =>
  pullRequest.autoMerge
    ? <span className="pr-blockers"><AutoMergeBadge /><MergeStatus pullRequest={pullRequest} long={long} /></span>
    : <MergeStatus pullRequest={pullRequest} long={long} />;

const MergeStatus: React.FC<{ pullRequest: PullRequestModel; long?: boolean }> = ({ pullRequest: pr, long = false }) => {
  if ((pr.blockers ?? []).length === 0 && unresolvedCount(pr) === 0) {
    if (canMerge(pr)) return <ReadyBadge long={long} />;
    const waiting = waitingOnChecks[pr.checkStatus];
    return waiting ? <Badge className="grey" icon={<FontAwesomeIcon icon="clock" />}>{waiting}</Badge> : <span className="pr-muted">—</span>;
  }
  return (
    <span className="pr-blockers">
      {canMerge(pr) && <ReadyBadge long={long} />}
      <MergeBlockerBadges pullRequest={pr} />
    </span>
  );
};

export const UpdatedText: React.FC<{ pullRequest: PullRequestModel }> = ({ pullRequest: pr }) => (
  <span title={exact(pr.updatedAt)}>updated {relative(pr.updatedAt)}</span>
);

export const UpdatedCell: React.FC<{ pullRequest: PullRequestModel }> = ({ pullRequest: pr }) => (
  <div className="pr-cell">
    <span title={exact(pr.updatedAt)}>{relative(pr.updatedAt)}</span>
    <span className="pr-muted" title={exact(pr.createdAt)}>opened {relative(pr.createdAt)}</span>
  </div>
);
