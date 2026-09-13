import { Badge, DataGrid, type ColumnDef } from "@andrewmclachlan/moo-ds";
import { DateTime } from "luxon";
import { useIsNarrow } from "../../../../hooks/useIsNarrow";
import { WorkflowRunCards, type WorkflowRunItem } from "./WorkflowRunCards";
import { useWorkflows } from "../../-hooks/useWorkflows";
import { BranchBadge } from "../shared/BranchBadge";

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const columns: ColumnDef<WorkflowRunItem>[] = [
  {
    field: (item) => item.run.workflowStatus,
    id: "status",
    header: "Status",
    cell: ({ row }) => <Badge className={row.run.workflowStatus?.toLowerCase()}>{row.run.conclusion || row.run.status}</Badge>,
    enableSorting: true,
  },
  {
    field: (item) => item.workflow.name,
    id: "workflow",
    header: "Workflow",
    enableSorting: true,
  },
  {
    field: (item) => item.run.headBranch,
    id: "branch",
    header: "Branch",
    cell: ({ row }) => <BranchBadge run={row.run} />,
    enableSorting: true,
  },
  {
    field: (item) => item.run.updatedAt,
    id: "run",
    header: "Run",
    cell: ({ row }) => {
      const updatedAt = DateTime.fromISO(row.run.updatedAt!);
      const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");
      return <span title={updatedAt.toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</span>;
    },
    enableSorting: true,
  },
  {
    field: (item) => item.repo.owner,
    id: "owner",
    header: "Owner",
    enableSorting: true,
  },
  {
    field: (item) => item.repo.name,
    id: "repository",
    header: "Repository",
    cell: ({ row }) => <a href={row.repo.htmlUrl!} target="_blank" rel="noopener noreferrer">{row.repo.name}</a>,
    enableSorting: true,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <a href={row.run.htmlUrl} target="_blank" rel="noopener noreferrer">View Run</a>,
    enableSorting: false,
  },
];

export const List = () => {

  const isNarrow = useIsNarrow();
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

  const showLoading = isLoading && !repositories;

  if (isNarrow) {
    return <WorkflowRunCards items={list} loading={showLoading} emptyMessage="No workflows found." />;
  }

  return (
    <DataGrid
      className="workflow-run-table"
      data={list}
      columns={columns}
      sortable
      loading={showLoading}
      emptyMessage="No workflows found."
    />
  );
};
