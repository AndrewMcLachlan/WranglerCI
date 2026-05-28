import { DateTime } from "luxon";
import { useAttention } from "../-hooks/useAttention";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { NoRepositories } from "../../../components/NoRepositories";
import { Spinner } from "../../../components/Spinner";
import type { AttentionItem, AttentionItemType } from "../../../api";

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const TYPE_LABEL: Record<AttentionItemType, string> = {
  WorkflowFailure: "Workflow failed",
  PullRequestReview: "Review requested",
};

const TYPE_CLASS: Record<AttentionItemType, string> = {
  WorkflowFailure: "red",
  PullRequestReview: "amber",
};

const itemKey = (item: AttentionItem) =>
  `${item.type}:${item.repositoryOwner}/${item.repositoryName}:${item.workflowRunId ?? item.pullRequestNumber ?? item.title}`;

const formatWhen = (iso: string): string => {
  const dt = DateTime.fromISO(iso);
  return dt.toRelative({ style: "long" }) ?? formatter.format(0, "seconds");
};

export const Attention = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: items, isLoading, isError, error } = useAttention();

  if (!selectedRepositories || selectedRepositories.length === 0) {
    return <NoRepositories />;
  }

  if (isError) {
    console.error("Error fetching attention feed:", error);
    return <p>Error loading attention feed.</p>;
  }

  return (
    <article className="attention">
      <h2>Needs your attention</h2>

      {isLoading && <Spinner />}

      {!isLoading && (!items || items.length === 0) && (
        <p className="attention-empty">Nothing is waiting on you across your selected repositories. ✨</p>
      )}

      {items && items.length > 0 && (
        <ul className="attention-list">
          {items.map((item) => (
            <li key={itemKey(item)} className="attention-item">
              <span className={`attention-badge ${TYPE_CLASS[item.type]}`}>{TYPE_LABEL[item.type]}</span>
              <div className="attention-body">
                <a className="attention-title" href={item.htmlUrl} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                <div className="attention-meta">
                  <span className="attention-repo">{item.repositoryOwner}/{item.repositoryName}</span>
                  {item.type === "WorkflowFailure" && item.branch && (
                    <span className="attention-branch">{item.branch}</span>
                  )}
                  {item.type === "PullRequestReview" && item.pullRequestNumber !== undefined && (
                    <span className="attention-pr">
                      #{item.pullRequestNumber}{item.pullRequestAuthor ? ` · ${item.pullRequestAuthor}` : ""}
                    </span>
                  )}
                </div>
              </div>
              <time className="attention-when" dateTime={typeof item.occurredAt === "string" ? item.occurredAt : undefined}>
                {formatWhen(item.occurredAt as string)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};
