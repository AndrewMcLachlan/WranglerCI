import { useMemo } from "react";
import { DateTime } from "luxon";
import { ComboBox } from "@andrewmclachlan/moo-ds";
import { useAttention } from "../-hooks/useAttention";
import { useAttentionTypeFilter } from "../-hooks/useAttentionTypeFilter";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { isAttentionOptedIn, isAttentionItemVisible } from "../../settings/-hooks/repositoryFeatures";
import { NoRepositories } from "../../../components/NoRepositories";
import { Spinner } from "../../../components/Spinner";
import { dotLabel, optionSearch } from "../../../components/filters/filterOptions";
import type { AttentionItem, AttentionItemType } from "../../../api";

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const TYPE_LABEL: Record<AttentionItemType, string> = {
  WorkflowFailure: "Workflow failed",
  PullRequestReview: "Review requested",
  SecurityAlert: "Security alert",
};

// Class used for the filter-chip dot per type. Security-alert item badges are
// coloured by severity instead (see badgeClass).
const TYPE_CLASS: Record<AttentionItemType, string> = {
  WorkflowFailure: "red",
  PullRequestReview: "amber",
  SecurityAlert: "purple",
};

const TYPE_OPTIONS: AttentionItemType[] = ["WorkflowFailure", "PullRequestReview", "SecurityAlert"];

const typeLabel = dotLabel<AttentionItemType>((t) => TYPE_CLASS[t], (t) => TYPE_LABEL[t]);
const typeSearch = optionSearch<AttentionItemType>(TYPE_OPTIONS, (t) => TYPE_LABEL[t]);

const SEVERITY_CLASS: Record<string, string> = {
  critical: "red",
  high: "red",
  medium: "amber",
  moderate: "amber",
  low: "grey",
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Security items badge on severity; other types badge on their fixed colour.
const badgeClass = (item: AttentionItem): string =>
  item.type === "SecurityAlert"
    ? SEVERITY_CLASS[(item.alertSeverity ?? "").toLowerCase()] ?? "amber"
    : TYPE_CLASS[item.type];

const badgeLabel = (item: AttentionItem): string =>
  item.type === "SecurityAlert"
    ? (item.alertSeverity ? capitalise(item.alertSeverity) : "Security")
    : TYPE_LABEL[item.type];

const itemKey = (item: AttentionItem) =>
  `${item.type}:${item.repositoryOwner}/${item.repositoryName}:${item.workflowRunId ?? item.pullRequestNumber ?? item.alertCategory ?? item.title}`;

const formatWhen = (iso: string): string => {
  const dt = DateTime.fromISO(iso);
  return dt.toRelative({ style: "long" }) ?? formatter.format(0, "seconds");
};

export const Attention = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: items, isLoading, isError, error } = useAttention();
  const [typeFilter, setTypeFilter] = useAttentionTypeFilter();

  const typeSet = useMemo(() => new Set(typeFilter), [typeFilter]);

  const optedInItems = useMemo(
    () => (items ?? []).filter((item) => isAttentionItemVisible(item, selectedRepositories)),
    [items, selectedRepositories],
  );

  const visibleItems = useMemo(
    () => optedInItems.filter((item) => typeSet.size === 0 || typeSet.has(item.type)),
    [optedInItems, typeSet],
  );

  if (!selectedRepositories?.some(isAttentionOptedIn)) {
    return <NoRepositories />;
  }

  if (isError) {
    console.error("Error fetching attention feed:", error);
    return <p>Error loading attention feed.</p>;
  }

  const hasItems = optedInItems.length > 0;

  return (
    <article className="attention">
      <h2>Needs your attention</h2>

      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Type</span>
          <ComboBox<AttentionItemType>
            className="filter-combo"
            placeholder="All types"
            multiSelect
            clearable
            items={TYPE_OPTIONS}
            selectedItems={typeFilter}
            labelField={typeLabel}
            valueField={(t) => t}
            search={(input) => typeSearch(input).filter((t) => !typeSet.has(t))}
            onChange={(items) => setTypeFilter(items)}
          />
        </div>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && !hasItems && (
        <p className="attention-empty">Nothing is waiting on you across your selected repositories. ✨</p>
      )}

      {hasItems && visibleItems.length === 0 && (
        <p className="attention-empty">No items match the current filter.</p>
      )}

      {visibleItems.length > 0 && (
        <ul className="attention-list">
          {visibleItems.map((item) => (
            <li key={itemKey(item)} className="attention-item">
              <span className={`attention-badge ${badgeClass(item)}`}>{badgeLabel(item)}</span>
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
                  {item.type === "SecurityAlert" && item.alertCategory && (
                    <span className="attention-alert">{item.alertCategory}</span>
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
