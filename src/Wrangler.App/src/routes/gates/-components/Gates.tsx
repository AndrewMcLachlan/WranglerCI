import { useMemo, useState } from "react";
import { Alert, Badge, DataGrid, type ColumnDef } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { useGates } from "../-hooks/useGates";
import { useApproveGates } from "../-hooks/useApproveGates";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { NoRepositories } from "../../../components/NoRepositories";
import type { DeploymentGateModel, GateApprovalResult } from "../../../api";

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const gateKey = (g: DeploymentGateModel) =>
  `${g.repositoryOwner}/${g.repositoryName}:${g.workflowRunId}:${g.environmentId}`;

export const Gates = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: gates, isLoading, isError, error } = useGates();
  const [alerts, setAlerts] = useState<GateApprovalResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { mutate: approveGates, isPending: isApproving } = useApproveGates({
    onResults: (results) => {
      const failures: GateApprovalResult[] = [];
      for (const result of results) {
        if (result.approved) {
          toast.success(`${result.repositoryOwner}/${result.repositoryName} · ${result.environmentName}: Approved`);
        } else {
          failures.push(result);
        }
      }
      // Approved gates stop being "waiting" and drop out on the next refetch
      // (triggered by the mutation's query invalidation), so just clear the
      // selection and surface any failures.
      setSelected(new Set());
      setAlerts(failures);
    },
  });

  const visibleGates = useMemo(() => gates ?? [], [gates]);
  const approvable = useMemo(() => visibleGates.filter((g) => g.currentUserCanApprove), [visibleGates]);

  const toggleSelection = (g: DeploymentGateModel) => {
    if (!g.currentUserCanApprove || isApproving) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const key = gateKey(g);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = approvable.length > 0 && approvable.every((g) => selected.has(gateKey(g)));

  const toggleSelectAll = () => {
    if (isApproving) return;
    setSelected(allSelected ? new Set() : new Set(approvable.map(gateKey)));
  };

  const handleApprove = () => {
    if (!gates) return;
    const toApprove = gates
      .filter((g) => selected.has(gateKey(g)))
      .map((g) => ({
        owner: g.repositoryOwner,
        repo: g.repositoryName,
        runId: g.workflowRunId,
        environmentId: g.environmentId,
        environmentName: g.environmentName,
      }));
    approveGates(toApprove);
  };

  const columns: ColumnDef<DeploymentGateModel>[] = useMemo(() => [
    {
      field: () => null,
      id: "select",
      header: () => <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={approvable.length === 0 || isApproving} />,
      cell: ({ row }) => <input type="checkbox" checked={selected.has(gateKey(row.original))} onChange={() => toggleSelection(row.original)} disabled={!row.original.currentUserCanApprove || isApproving} />,
      enableSorting: false,
    },
    {
      field: (g: DeploymentGateModel) => `${g.repositoryOwner}/${g.repositoryName}`,
      id: "repository",
      header: "Repository",
      enableSorting: true,
    },
    {
      field: "workflowName",
      header: "Workflow",
      cell: ({ row }) => (
        <a href={row.original.htmlUrl!} target="_blank" rel="noopener noreferrer">
          {row.original.workflowName} #{row.original.runNumber}
        </a>
      ),
      enableSorting: true,
    },
    {
      field: "environmentName",
      header: "Environment",
      cell: ({ row }) => <Badge className="gate-environment" pill>{row.original.environmentName}</Badge>,
      enableSorting: true,
    },
    {
      field: "headBranch",
      header: "Branch",
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
        <a className="gate-open-link" href={row.original.htmlUrl!} target="_blank" rel="noopener noreferrer" title="Open on GitHub" aria-label="Open run on GitHub">
          <FontAwesomeIcon icon="arrow-up-right-from-square" />
        </a>
      ),
      enableSorting: false,
    },
  ], [selected, allSelected, approvable.length, isApproving]);

  if (!selectedRepositories || selectedRepositories.length === 0) {
    return <NoRepositories />;
  }

  if (isError) {
    console.error("Error fetching deployment gates:", error);
    return <p>Error loading deployment gates.</p>;
  }

  return (
    <article className="gates">
      <h2>Deployment Gates</h2>

      <div className="controls">
        <div className="actions">
          <button className="btn btn-primary" onClick={handleApprove} disabled={selected.size === 0 || isApproving}>
            {isApproving ? "Approving..." : "Approve Selected"}
          </button>
        </div>
      </div>

      {alerts.map((result, i) => (
        <Alert
          key={`${result.repositoryOwner}/${result.repositoryName}:${result.workflowRunId}:${result.environmentName}:${i}`}
          variant="danger"
          dismissible
          onClose={() => setAlerts((prev) => prev.filter((a) => a !== result))}
        >
          {result.repositoryOwner}/{result.repositoryName} · {result.environmentName}: Failed
          {result.error && <span> - {result.error}</span>}
        </Alert>
      ))}

      <DataGrid
        className="gate-table"
        data={visibleGates}
        columns={columns}
        sortable
        loading={isLoading}
        emptyMessage="No deployment gates are waiting for approval."
      />
    </article>
  );
};
