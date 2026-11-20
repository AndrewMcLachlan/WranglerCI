import { SwipeRow } from "@andrewmclachlan/moo-ds";
import { RowCard } from "../../../components/RowCard";
import { ScrollRestoredList } from "../../../components/ScrollRestoredList";
import { CheckStatusBadge } from "./CheckStatusBadge";
import { MergeCell, PullRequestContext, PullRequestLabels, UpdatedText } from "./PullRequestCells";
import { canMerge, canSelect } from "./prState";
import type { PullRequestModel } from "../../../api";

interface PullRequestCardsProps {
  pullRequests: PullRequestModel[];
  selected: Set<number | string>;
  onToggle: (pr: PullRequestModel) => void;
  onApprove: (pr: PullRequestModel) => void;
  onRefresh: () => Promise<unknown>;
  disabled: boolean;
  loading: boolean;
  emptyMessage: string;
}

/** The narrow-viewport rendering of the pull request table. */
export const PullRequestCards: React.FC<PullRequestCardsProps> = ({
  pullRequests, selected, onToggle, onApprove, onRefresh, disabled, loading, emptyMessage,
}) => {
  if (loading) return <p className="row-card-message">Loading...</p>;
  if (pullRequests.length === 0) return <p className="row-card-message">{emptyMessage}</p>;

  return (
    <ScrollRestoredList id="pull-request-cards" onRefresh={onRefresh} className="row-card-list">
      {pullRequests.map((pr) => (
        <SwipeRow
          key={`${pr.repositoryOwner}/${pr.repositoryName}#${pr.number}`}
          actions={[
            {
              key: "merge",
              label: "Merge",
              variant: "primary",
              disabled: !canMerge(pr) || disabled,
              onAction: () => onApprove(pr),
            },
            {
              key: "open",
              label: "GitHub",
              onAction: () => window.open(pr.htmlUrl!, "_blank", "noopener,noreferrer"),
            },
          ]}
        >
        <RowCard
          onSelect={() => onToggle(pr)}
          selected={selected.has(pr.number)}
          selectDisabled={!canSelect(pr) || disabled}
          selectLabel={`Select pull request ${pr.number}`}
          title={pr.title}
          subtitle={
            <>
              <PullRequestContext pullRequest={pr} labels={false} />
              {!!pr.labels?.length && <span className="pr-labels"><PullRequestLabels pullRequest={pr} /></span>}
            </>
          }
          href={pr.htmlUrl!}
          hrefLabel="Open pull request on GitHub"
          meta={
            <>
              <CheckStatusBadge status={pr.checkStatus} long />
              <MergeCell pullRequest={pr} long />
            </>
          }
          footer={
            <>
              <span>{pr.author}</span>
              <UpdatedText pullRequest={pr} />
            </>
          }
        />
        </SwipeRow>
      ))}
    </ScrollRestoredList>
  );
};
