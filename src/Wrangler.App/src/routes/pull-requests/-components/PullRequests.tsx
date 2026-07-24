import { useMemo, useState } from "react";
import { Alert, ComboBox, DataGrid, type ColumnDef } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { usePullRequests } from "../-hooks/usePullRequests";
import { usePrAuthors, useUpdatePrAuthors } from "../-hooks/usePrAuthors";
import { usePrStatusFilter } from "../-hooks/usePrStatusFilter";
import { usePrIncludeTags, usePrExcludeTags } from "../-hooks/usePrTagFilter";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { NoRepositories } from "../../../components/NoRepositories";
import { useUserSearch } from "../-hooks/useUserSearch";
import { useApprovePullRequests } from "../-hooks/useApprovePullRequests";
import { Badge } from "@andrewmclachlan/moo-ds";
import { CheckStatusBadge } from "./CheckStatusBadge";
import { dotLabel, optionSearch } from "../../../components/filters/filterOptions";
import type { ApprovalResult, CheckStatus, PullRequestModel } from "../../../api";

export const canApprove = (pr: PullRequestModel) => pr.checkStatus === "Success" && pr.mergeable !== false;

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const STATUS_OPTIONS: CheckStatus[] = ["Success", "Failure", "Pending", "Unknown"];

const STATUS_DOT: Record<CheckStatus, string> = {
  Success: "green",
  Failure: "red",
  Pending: "amber",
  Unknown: "grey",
};

// Solid pill colour per status — the dropdown keeps the dot cue, the selected
// pill is tinted the whole status colour (dark text set in CSS for contrast).
const STATUS_COLOUR: Record<CheckStatus, string> = {
  Success: "#6bcc6b",
  Failure: "#ff6b6b",
  Pending: "#e8c44a",
  Unknown: "#9ea3a8",
};

const statusLabel = dotLabel<CheckStatus>((s) => STATUS_DOT[s], (s) => s);
const statusSearch = optionSearch<CheckStatus>(STATUS_OPTIONS, (s) => s);

interface AuthorOption {
  login: string;
}

const prKey = (owner: string, repo: string, number: number | string) =>
  `${owner}/${repo}#${number}`;

interface TagOption {
  name: string;
  color: string;
}

// Fallback colour (6-char hex, no leading '#') for a persisted tag that is not
// present on any currently-loaded PR, so its chip still renders.
const FALLBACK_TAG_COLOUR = "6e7681";

export const PullRequests = () => {

  const queryClient = useQueryClient();
  const { data: selectedRepositories } = useSelectedRepositories();
  const prRepositories = useMemo(
    () => selectedRepositories.filter((r) => r.pullRequests === true),
    [selectedRepositories]);
  const { data: authors } = usePrAuthors();
  const { mutate: updateAuthors } = useUpdatePrAuthors();
  const { data: pullRequests, isLoading, isError, error } = usePullRequests();
  const [statusFilter, setStatusFilter] = usePrStatusFilter();
  const [includeTags, setIncludeTags] = usePrIncludeTags();
  const [excludeTags, setExcludeTags] = usePrExcludeTags();
  const [alerts, setAlerts] = useState<ApprovalResult[]>([]);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [authorQuery, setAuthorQuery] = useState("");
  const { data: authorSuggestions } = useUserSearch(authorQuery);

  // Remote suggestions as ComboBox items, minus already-selected authors.
  // Passing them as `items` keeps the open dropdown reactive when the
  // debounced query resolves after the search callback has already run.
  const authorItems = useMemo<AuthorOption[]>(
    () => (authorSuggestions ?? [])
      .filter((u) => !authors.includes(u.login))
      .map((u) => ({ login: u.login })),
    [authorSuggestions, authors]);

  const selectedAuthorItems = useMemo<AuthorOption[]>(() => authors.map((login) => ({ login })), [authors]);

  const { mutate: approvePullRequests, isPending: isApproving } = useApprovePullRequests({
    onResults: (results) => {
      const failures: ApprovalResult[] = [];
      const mergedKeys = new Set<string>();

      for (const result of results) {
        if (result.merged) {
          toast.success(`${result.repositoryOwner}/${result.repositoryName} #${result.pullRequestNumber}: Merged`);
          mergedKeys.add(prKey(result.repositoryOwner, result.repositoryName, result.pullRequestNumber));
        } else {
          failures.push(result);
        }
      }

      // Optimistically drop merged PRs from the cached list so the table
      // updates before the background refetch returns.
      if (mergedKeys.size > 0) {
        queryClient.setQueriesData<PullRequestModel[]>(
          { queryKey: ["pullRequests"] },
          (prev) => prev?.filter((pr) => !mergedKeys.has(prKey(pr.repositoryOwner, pr.repositoryName, pr.number))),
        );

        // Clear selection for PRs we just merged; leave selection intact for
        // anything that failed so the user can re-try.
        setSelected((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          for (const pr of pullRequests ?? []) {
            if (mergedKeys.has(prKey(pr.repositoryOwner, pr.repositoryName, pr.number))) next.delete(pr.number);
          }
          return next;
        });
      }

      setAlerts(failures);
    },
  });

  const statusSet = useMemo(() => new Set(statusFilter), [statusFilter]);

  // Deduplicated union of labels across the loaded PRs (first-seen colour wins),
  // sorted by name — this is the typeahead suggestion set for both tag filters.
  const availableTags = useMemo<TagOption[]>(() => {
    const byName = new Map<string, string>();
    for (const pr of pullRequests ?? []) {
      for (const label of pr.labels ?? []) {
        if (!byName.has(label.name)) byName.set(label.name, label.color);
      }
    }
    return [...byName.entries()]
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pullRequests]);

  // Resolve stored tag names to options, falling back to a neutral colour for a
  // persisted tag that is no longer on any loaded PR so its chip still renders.
  const toTagOptions = (names: string[]): TagOption[] => {
    const colours = new Map(availableTags.map((t) => [t.name, t.color]));
    return names.map((name) => ({ name, color: colours.get(name) ?? FALLBACK_TAG_COLOUR }));
  };
  const includeTagOptions = useMemo(() => toTagOptions(includeTags), [includeTags, availableTags]);
  const excludeTagOptions = useMemo(() => toTagOptions(excludeTags), [excludeTags, availableTags]);

  const includeSet = useMemo(() => new Set(includeTags), [includeTags]);
  const excludeSet = useMemo(() => new Set(excludeTags), [excludeTags]);

  const visiblePullRequests = useMemo(
    () => (pullRequests ?? []).filter((pr) => {
      if (statusSet.size !== 0 && !statusSet.has(pr.checkStatus)) return false;
      const labelNames = (pr.labels ?? []).map((l) => l.name);
      // Inclusive filter (OR): empty means no constraint.
      if (includeSet.size !== 0 && !labelNames.some((n) => includeSet.has(n))) return false;
      // Exclusive filter: any match hides the PR. Applied after include, so a
      // tag in both include and exclude resolves pessimistically (hidden).
      if (labelNames.some((n) => excludeSet.has(n))) return false;
      return true;
    }),
    [pullRequests, statusSet, includeSet, excludeSet],
  );
  const approvable = visiblePullRequests.filter(canApprove);

  const toggleSelection = (pr: PullRequestModel) => {
    if (!canApprove(pr) || isApproving) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pr.number)) {
        next.delete(pr.number);
      } else {
        next.add(pr.number);
      }
      return next;
    });
  };

  const allSelected = approvable.length > 0 && approvable.every(pr => selected.has(pr.number));

  const toggleSelectAll = () => {
    if (isApproving) return;
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(approvable.map(pr => pr.number)));
    }
  };

  const handleApprove = () => {
    if (!pullRequests) return;
    const toApprove = pullRequests
      .filter(pr => selected.has(pr.number))
      .map(pr => ({ owner: pr.repositoryOwner, repo: pr.repositoryName, number: pr.number }));
    approvePullRequests(toApprove);
    // Keep the selection on the rows while the round-trip is in flight; the
    // onResults callback clears successfully-merged rows and leaves failures
    // selected so the user can act on them again.
  };

  // Add an author by exact login — used by the ComboBox's creatable option
  // (so bots like dependabot[bot], which user search won't surface, stay
  // addable).
  const addAuthor = (value: string) => {
    const login = value.trim().replace(/[,;]/g, "");
    if (login !== "" && !authors.includes(login)) {
      updateAuthors([...authors, login]);
    }
    setAuthorQuery("");
  };

  // ComboBox search callback: drives the debounced remote user search via
  // authorQuery and returns whatever suggestions are currently loaded.
  const authorSearch = (input: string) => {
    setAuthorQuery(input);
    const query = input.trim().toLowerCase();
    return authorItems.filter((o) => o.login.toLowerCase().includes(query));
  };

  // Free-text tag entry — the suggestion list only holds labels on currently
  // loaded PRs, so any other tag name stays addable.
  const addIncludeTag = (value: string) => {
    const tag = value.trim();
    if (tag !== "" && !includeTags.includes(tag)) {
      setIncludeTags([...includeTags, tag]);
    }
  };

  const addExcludeTag = (value: string) => {
    const tag = value.trim();
    if (tag !== "" && !excludeTags.includes(tag)) {
      setExcludeTags([...excludeTags, tag]);
    }
  };

  const columns: ColumnDef<PullRequestModel>[] = useMemo(() => [
    {
      field: () => null,
      id: "select",
      header: () => <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={approvable.length === 0 || isApproving} />,
      cell: ({ row }) => <input type="checkbox" checked={selected.has(row.original.number)} onChange={() => toggleSelection(row.original)} disabled={!canApprove(row.original) || isApproving} />,
      enableSorting: false,
    },
    {
      field: (pr: PullRequestModel) => `${pr.repositoryOwner}/${pr.repositoryName}`,
      id: "repository",
      header: "Repository",
      enableSorting: true,
    },
    {
      field: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="pr-title-cell">
          <a href={row.original.htmlUrl!} target="_blank" rel="noopener noreferrer">{row.original.title}</a>
          {row.original.labels && row.original.labels.length > 0 && (
            <span className="pr-labels">
              {row.original.labels.map((label) => (
                <Badge
                  key={label.name}
                  className="pr-label"
                  pill
                  muted
                  colour={`#${label.color}`}
                >
                  {label.name}
                </Badge>
              ))}
            </span>
          )}
        </div>
      ),
      enableSorting: true,
    },
    {
      field: "author",
      header: "Author",
      enableSorting: true,
    },
    {
      field: "checkStatus",
      header: "Status",
      cell: ({ row }) => (
        <>
          <CheckStatusBadge status={row.original.checkStatus} />
          {row.original.mergeable === false && <Badge className="red">Conflict</Badge>}
        </>
      ),
      enableSorting: true,
    },
    {
      field: "updatedAt",
      header: "Updated",
      cell: ({ getValue }) => {
        const updatedAt = DateTime.fromISO(getValue() as string);
        const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");
        return <span title={updatedAt.toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</span>;
      },
      enableSorting: true,
    },
    {
      field: () => null,
      id: "open",
      header: "",
      cell: ({ row }) => (
        <a
          className="pr-open-link"
          href={row.original.htmlUrl!}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on GitHub"
          aria-label="Open pull request on GitHub"
        >
          <FontAwesomeIcon icon="arrow-up-right-from-square" />
        </a>
      ),
      enableSorting: false,
    },
  ], [selected, allSelected, approvable.length, isApproving]);

  if (prRepositories.length === 0) {
    return (
      <NoRepositories
        title="No repositories opted into Pull Requests"
        message={<>Head over to <Link to="/settings">Settings</Link> and switch on <strong>Pull Requests</strong> for the repositories you want to see here.</>}
      />
    );
  }

  return (
    <article className="pull-requests">
      <h2>Pull Requests</h2>

      <div className="controls">
        <div className="filter-bar">
          <ComboBox<AuthorOption>
            className="filter-combo"
            placeholder="Authors..."
            multiSelect
            clearable
            creatable
            createLabel={(input) => `Add "${input.trim()}"`}
            items={authorItems}
            selectedItems={selectedAuthorItems}
            labelField={(o) => o.login}
            valueField={(o) => o.login}
            search={authorSearch}
            onCreate={addAuthor}
            onChange={(items) => updateAuthors(items.map((o) => o.login))}
          />
          <ComboBox<CheckStatus>
            className="filter-combo status-combo"
            placeholder="Any status"
            multiSelect
            clearable
            items={STATUS_OPTIONS}
            selectedItems={statusFilter}
            labelField={statusLabel}
            valueField={(s) => s}
            colourField={(s) => STATUS_COLOUR[s]}
            search={statusSearch}
            onChange={(items) => setStatusFilter(items)}
          />
          <ComboBox<TagOption>
            className="filter-combo"
            placeholder="Include tags..."
            multiSelect
            clearable
            creatable
            createLabel={(input) => `Include "${input.trim()}"`}
            items={availableTags}
            selectedItems={includeTagOptions}
            labelField={(t) => t.name}
            valueField={(t) => t.name}
            colourField={(t) => `#${t.color}`}
            onCreate={addIncludeTag}
            onChange={(items) => setIncludeTags(items.map((t) => t.name))}
          />
          <ComboBox<TagOption>
            className="filter-combo"
            placeholder="Exclude tags..."
            multiSelect
            clearable
            creatable
            createLabel={(input) => `Exclude "${input.trim()}"`}
            items={availableTags}
            selectedItems={excludeTagOptions}
            labelField={(t) => t.name}
            valueField={(t) => t.name}
            colourField={(t) => `#${t.color}`}
            onCreate={addExcludeTag}
            onChange={(items) => setExcludeTags(items.map((t) => t.name))}
          />
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleApprove} disabled={selected.size === 0 || isApproving}>
            {isApproving ? "Approving..." : "Approve & Merge Selected"}
          </button>
        </div>
      </div>

      {alerts.map(result => (
        <Alert
          key={`${result.repositoryOwner}/${result.repositoryName}#${result.pullRequestNumber}`}
          variant={result.approved ? "warning" : "danger"}
          dismissible
          onClose={() => setAlerts(prev => prev.filter(a => a !== result))}
        >
          {result.repositoryOwner}/{result.repositoryName} #{result.pullRequestNumber}:
          {result.approved ? " Approved (merge failed)" : " Failed"}
          {result.error && <span> - {result.error}</span>}
        </Alert>
      ))}

      <DataGrid
        className="pull-request-table"
        data={visiblePullRequests}
        columns={columns}
        sortable
        loading={isLoading}
        emptyMessage="No open pull requests found."
      />
    </article>
  );
};
