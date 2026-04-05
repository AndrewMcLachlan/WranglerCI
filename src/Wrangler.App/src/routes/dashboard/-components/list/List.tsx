import { DataGrid, createColumnHelper } from "@andrewmclachlan/moo-ds";
import { DateTime } from "luxon";
import type { ColumnDef } from "@tanstack/react-table";
import type { RepositoryModel, WorkflowModel, WorkflowRunModel } from "../../../../api";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { Badge } from "../shared/Badge";

interface WorkflowRunItem {
  repo: RepositoryModel;
  workflow: WorkflowModel;
  run: WorkflowRunModel;
}

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const columnHelper = createColumnHelper<WorkflowRunItem>();

const columns: ColumnDef<WorkflowRunItem, any>[] = [
  columnHelper.accessor(item => item.run.workflowStatus, {
    id: "status",
    header: "Status",
    cell: ({ row }) => <Badge className={row.original.run.workflowStatus?.toLowerCase()}>{row.original.run.conclusion || row.original.run.status}</Badge>,
    enableSorting: true,
  }),
  columnHelper.accessor(item => item.workflow.name, {
    id: "workflow",
    header: "Workflow",
    enableSorting: true,
  }),
  columnHelper.accessor(item => item.run.headBranch, {
    id: "branch",
    header: "Branch",
    cell: ({ getValue }) => <Badge>{getValue()}</Badge>,
    enableSorting: true,
  }),
  columnHelper.accessor(item => item.run.updatedAt, {
    id: "run",
    header: "Run",
    cell: ({ getValue }) => {
      const updatedAt = DateTime.fromISO(getValue()!);
      const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");
      return <span title={updatedAt.toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</span>;
    },
    enableSorting: true,
  }),
  columnHelper.accessor(item => item.repo.owner, {
    id: "owner",
    header: "Owner",
    enableSorting: true,
  }),
  columnHelper.accessor(item => item.repo.name, {
    id: "repository",
    header: "Repository",
    cell: ({ row }) => <a href={row.original.repo.htmlUrl!} target="_blank" rel="noopener noreferrer">{row.original.repo.name}</a>,
    enableSorting: true,
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: ({ row }) => <a href={row.original.run.htmlUrl} target="_blank" rel="noopener noreferrer">View Run</a>,
  }),
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
