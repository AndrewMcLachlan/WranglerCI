import { useMemo, useState } from "react";
import { Alert, DataGrid, type ColumnDef } from "@andrewmclachlan/moo-ds";
import { CloseBadge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { usePullRequests } from "../-hooks/usePullRequests";
import { usePrAuthors, useUpdatePrAuthors } from "../-hooks/usePrAuthors";
import { usePrStatusFilter } from "../-hooks/usePrStatusFilter";
import { useApprovePullRequests } from "../-hooks/useApprovePullRequests";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { Badge } from "@andrewmclachlan/moo-ds";
import { CheckStatusBadge } from "./CheckStatusBadge";
import { NoRepositories } from "../../../components/NoRepositories";
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

const prKey = (owner: string, repo: string, number: number | string) =>
  `${owner}/${repo}#${number}`;

export const PullRequests = () => {

  const queryClient = useQueryClient();
  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: authors } = usePrAuthors();
  const { mutate: updateAuthors } = useUpdatePrAuthors();
  const { data: pullRequests, isLoading, isError, error } = usePullRequests();
  const [statusFilter, setStatusFilter] = usePrStatusFilter();
  const [alerts, setAlerts] = useState<ApprovalResult[]>([]);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());

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
  const toggleStatus = (status: CheckStatus) => {
    const next = new Set(statusSet);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setStatusFilter([...next]);
  };

  const visiblePullRequests = useMemo(
    () => (pullRequests ?? []).filter((pr) => statusSet.size === 0 || statusSet.has(pr.checkStatus)),
    [pullRequests, statusSet],
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

  const checkInput = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (e.type === "keyup") {
      const keyEvent = e as React.KeyboardEvent<HTMLInputElement>;
      if (keyEvent.key !== "Enter" && keyEvent.key !== " " && keyEvent.key !== "," && keyEvent.key !== ";") {
        return;
      }
    }
    e.preventDefault();
    const value = e.currentTarget.value.trim();
    if (value !== "" && !authors.includes(value)) {
      updateAuthors([...authors, value]);
      e.currentTarget.value = "";
    }
  };

  const removeAuthor = (author: string) => {
    updateAuthors(authors.filter(a => a !== author));
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

  if (!selectedRepositories || selectedRepositories.length === 0) {
    return <NoRepositories />;
  }

  return (
    <article className="pull-requests">
      <h2>Pull Requests</h2>

      <div className="controls">
        <div className="pr-filters">
          <input type="text" className="form-control author-input" placeholder="Add author filter..." onKeyUp={checkInput} onBlur={checkInput} />
          <div className="status-filter" role="group" aria-label="Filter by check status">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                className={`status-chip${statusSet.has(status) ? " active" : ""}`}
                aria-pressed={statusSet.has(status)}
                onClick={() => toggleStatus(status)}
              >
                <span className={`status-dot ${STATUS_DOT[status]}`} />
                {status}
              </button>
            ))}
          </div>
          <div className="author-badges">
            {authors.map(author => (
              <CloseBadge key={author} onClose={() => removeAuthor(author)}>{author}</CloseBadge>
            ))}
          </div>
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
