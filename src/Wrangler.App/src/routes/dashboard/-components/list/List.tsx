import { Badge, DataGrid, type ColumnDef } from "@andrewmclachlan/moo-ds";
import { DateTime } from "luxon";
import type { RepositoryModel, WorkflowModel, WorkflowRunModel } from "../../../../api";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { BranchBadge } from "../shared/BranchBadge";

interface WorkflowRunItem {
  repo: RepositoryModel;
  workflow: WorkflowModel;
  run: WorkflowRunModel;
}

// moo-ds's ColumnDef is a union (keyed vs computed `field`), which the TS6-based
// compiler used for linting can't use to contextually infer the `cell` callback's
// argument — it falls back to implicit `any`. The cells only read `row.original`,
// so annotate that minimal shape explicitly; this is assignable to TanStack's
// full CellContext and compiles under both compilers.
type CellProps = { row: { original: WorkflowRunItem } };

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const columns: ColumnDef<WorkflowRunItem>[] = [
  {
    field: (item: WorkflowRunItem) => item.run.workflowStatus,
    id: "status",
    header: "Status",
    cell: ({ row }: CellProps) => <Badge className={row.original.run.workflowStatus?.toLowerCase()}>{row.original.run.conclusion || row.original.run.status}</Badge>,
    enableSorting: true,
  },
  {
    field: (item: WorkflowRunItem) => item.workflow.name,
    id: "workflow",
    header: "Workflow",
    enableSorting: true,
  },
  {
    field: (item: WorkflowRunItem) => item.run.headBranch,
    id: "branch",
    header: "Branch",
    cell: ({ row }: CellProps) => <BranchBadge run={row.original.run} />,
    enableSorting: true,
  },
  {
    field: (item: WorkflowRunItem) => item.run.updatedAt,
    id: "run",
    header: "Run",
    cell: ({ row }: CellProps) => {
      const updatedAt = DateTime.fromISO(row.original.run.updatedAt!);
      const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");
      return <span title={updatedAt.toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</span>;
    },
    enableSorting: true,
  },
  {
    field: (item: WorkflowRunItem) => item.repo.owner,
    id: "owner",
    header: "Owner",
    enableSorting: true,
  },
  {
    field: (item: WorkflowRunItem) => item.repo.name,
    id: "repository",
    header: "Repository",
    cell: ({ row }: CellProps) => <a href={row.original.repo.htmlUrl!} target="_blank" rel="noopener noreferrer">{row.original.repo.name}</a>,
    enableSorting: true,
  },
  {
    field: () => null,
    id: "actions",
    header: "",
    cell: ({ row }: CellProps) => <a href={row.original.run.htmlUrl} target="_blank" rel="noopener noreferrer">View Run</a>,
    enableSorting: false,
  },
];

export const List = () => {

  const { data: repositories, isLoading } = useWorkflows();

  const list: WorkflowRunItem[] = repositories?.flatMap(repo =>
    repo.workflows?.flatMap(workflow =>
      workflow.runs?.map(run => ({
        repo,
        workflow,
        run,
      })) ?? []
    ) ?? []
  ) ?? [];

  return (
    <DataGrid
      className="workflow-run-table"
      data={list}
      columns={columns}
      sortable
      loading={isLoading}
      emptyMessage="No workflows found."
    />
  );
};
