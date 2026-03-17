import { useMemo, useState } from "react";
import { Alert, DataGrid, createColumnHelper } from "@andrewmclachlan/moo-ds";
import { CloseBadge } from "@andrewmclachlan/moo-ds";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import type { ColumnDef } from "@tanstack/react-table";
import { usePullRequests } from "../-hooks/usePullRequests";
import { usePrAuthors, useUpdatePrAuthors } from "../-hooks/usePrAuthors";
import { useApprovePullRequests } from "../-hooks/useApprovePullRequests";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { CheckStatusBadge } from "./CheckStatusBadge";
import { Badge } from "../../dashboard/-components/Badge";
import { NoRepositories } from "../../../components/NoRepositories";
import type { ApprovalResult, PullRequestModel } from "../../../api";

export const canApprove = (pr: PullRequestModel) => pr.checkStatus === "Success" && pr.mergeable !== false;

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const columnHelper = createColumnHelper<PullRequestModel>();

export const PullRequests = () => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: authors } = usePrAuthors();
  const { mutate: updateAuthors } = useUpdatePrAuthors();
  const { data: pullRequests, isLoading, isError, error } = usePullRequests();
  const [alerts, setAlerts] = useState<ApprovalResult[]>([]);
  const { mutate: approvePullRequests, isPending: isApproving } = useApprovePullRequests({
    onResults: (results) => {
      const failures: ApprovalResult[] = [];
      for (const result of results) {
        if (result.merged) {
          toast.success(`${result.repositoryOwner}/${result.repositoryName} #${result.pullRequestNumber}: Merged`);
        } else {
          failures.push(result);
        }
      }
      setAlerts(failures);
    },
  });

  const [selected, setSelected] = useState<Set<number | string>>(new Set());

  const approvable = pullRequests?.filter(canApprove) ?? [];

  const toggleSelection = (pr: PullRequestModel) => {
    if (!canApprove(pr)) return;
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
    setSelected(new Set());
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

  const columns: ColumnDef<PullRequestModel, any>[] = useMemo(() => [
    columnHelper.display({
      id: "select",
      header: () => <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={approvable.length === 0} />,
      cell: ({ row }) => <input type="checkbox" checked={selected.has(row.original.number)} onChange={() => toggleSelection(row.original)} disabled={!canApprove(row.original)} />,
      enableSorting: false,
    }),
    columnHelper.accessor(pr => `${pr.repositoryOwner}/${pr.repositoryName}`, {
      id: "repository",
      header: "Repository",
      enableSorting: true,
    }),
    columnHelper.accessor("title", {
      header: "Title",
      cell: ({ row }) => <a href={row.original.htmlUrl!} target="_blank" rel="noopener noreferrer">{row.original.title}</a>,
      enableSorting: true,
    }),
    columnHelper.accessor("author", {
      header: "Author",
      enableSorting: true,
    }),
    columnHelper.accessor("checkStatus", {
      header: "Status",
      cell: ({ row }) => (
        <>
          <CheckStatusBadge status={row.original.checkStatus} />
          {row.original.mergeable === false && <Badge className="red">Conflict</Badge>}
        </>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("updatedAt", {
      header: "Updated",
      cell: ({ getValue }) => {
        const updatedAt = DateTime.fromISO(getValue()!);
        const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");
        return <span title={updatedAt.toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</span>;
      },
      enableSorting: true,
    }),
  ], [selected, allSelected, approvable.length]);

  if (!selectedRepositories || selectedRepositories.length === 0) {
    return <NoRepositories />;
  }

  return (
    <article className="pull-requests">
      <h2>Pull Requests</h2>

      <div className="controls">
        <div className="author-filter">
          <input type="text" className="form-control" placeholder="Add author filter..." onKeyUp={checkInput} onBlur={checkInput} />
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
        data={pullRequests ?? []}
        columns={columns}
        sortable
        loading={isLoading}
        emptyMessage="No open pull requests found."
      />
    </article>
  );
};
