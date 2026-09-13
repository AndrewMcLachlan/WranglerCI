import { Badge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DateTime } from "luxon";
import { RowCard } from "../../../components/RowCard";
import { CheckStatusBadge } from "./CheckStatusBadge";
import { canApprove } from "./PullRequests";
import type { PullRequestModel } from "../../../api";

interface PullRequestCardsProps {
  pullRequests: PullRequestModel[];
  selected: Set<number | string>;
  onToggle: (pr: PullRequestModel) => void;
  disabled: boolean;
  loading: boolean;
  emptyMessage: string;
}

const relative = (iso?: string | null) => {
  if (!iso) return "—";
  const updatedAt = DateTime.fromISO(iso);
  return updatedAt.toRelative({ style: "long" }) ?? "just now";
};

/** The narrow-viewport rendering of the pull request table. */
export const PullRequestCards: React.FC<PullRequestCardsProps> = ({
  pullRequests, selected, onToggle, disabled, loading, emptyMessage,
}) => {
  if (loading) return <p className="row-card-message">Loading...</p>;
  if (pullRequests.length === 0) return <p className="row-card-message">{emptyMessage}</p>;

  return (
    <div className="row-card-list">
      {pullRequests.map((pr) => (
        <RowCard
          key={`${pr.repositoryOwner}/${pr.repositoryName}#${pr.number}`}
          onSelect={() => onToggle(pr)}
          selected={selected.has(pr.number)}
          selectDisabled={!canApprove(pr) || disabled}
          selectLabel={`Select pull request ${pr.number}`}
          title={<a href={pr.htmlUrl!} target="_blank" rel="noopener noreferrer">{pr.title}</a>}
          meta={
            <>
              <CheckStatusBadge status={pr.checkStatus} />
              {pr.mergeable === false && <Badge className="red">Conflict</Badge>}
              {pr.labels?.map((label) => (
                <Badge key={label.name} className="pr-label" pill muted colour={`#${label.color}`}>
                  {label.name}
                </Badge>
              ))}
            </>
          }
          details={[
            { label: "Repository", value: `${pr.repositoryOwner}/${pr.repositoryName}` },
            { label: "Author", value: pr.author },
            { label: "Updated", value: relative(pr.updatedAt) },
          ]}
          actions={
            <a
              className="pr-open-link"
              href={pr.htmlUrl!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open pull request on GitHub"
            >
              <FontAwesomeIcon icon="arrow-up-right-from-square" /> Open on GitHub
            </a>
          }
        />
      ))}
    </div>
  );
};
