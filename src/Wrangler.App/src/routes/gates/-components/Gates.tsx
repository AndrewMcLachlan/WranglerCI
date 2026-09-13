import { useMemo, useState } from "react";
import { Alert, Badge, ComboBox, DataGrid, type ColumnDef } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { useGates } from "../-hooks/useGates";
import { useApproveGates } from "../-hooks/useApproveGates";
import { useGateEnvironmentFilter, useGateBranchFilter, useGateRepositoryFilter, useGateWorkflowFilter } from "../-hooks/useGateFilters";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";
import { NoRepositories } from "../../../components/NoRepositories";
import { useIsNarrow } from "../../../hooks/useIsNarrow";
import { GateCards } from "./GateCards";
import type { DeploymentGateModel, GateApprovalResult } from "../../../api";

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const gateKey = (g: DeploymentGateModel) =>
  `${g.repositoryOwner}/${g.repositoryName}:${g.workflowRunId}:${g.environmentId}`;

const gateRepoName = (g: DeploymentGateModel) => `${g.repositoryOwner}/${g.repositoryName}`;

// Unique, sorted option list from the loaded gates for one filter kind.
const optionsFrom = (gates: DeploymentGateModel[], field: (g: DeploymentGateModel) => string | undefined | null): string[] =>
  [...new Set(gates.map(field).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

export const Gates = () => {
  const isNarrow = useIsNarrow();
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

  const [environmentFilter, setEnvironmentFilter] = useGateEnvironmentFilter();
  const [branchFilter, setBranchFilter] = useGateBranchFilter();
  const [repositoryFilter, setRepositoryFilter] = useGateRepositoryFilter();
  const [workflowFilter, setWorkflowFilter] = useGateWorkflowFilter();

  const environmentOptions = useMemo(() => optionsFrom(gates ?? [], (g) => g.environmentName), [gates]);
  const branchOptions = useMemo(() => optionsFrom(gates ?? [], (g) => g.headBranch), [gates]);
  const repositoryOptions = useMemo(() => optionsFrom(gates ?? [], gateRepoName), [gates]);
  const workflowOptions = useMemo(() => optionsFrom(gates ?? [], (g) => g.workflowName), [gates]);

  // Each filter is a ComboBox over the values present in the loaded gates,
  // creatable so any value can be entered up front.
  const gateFilters = [
    { placeholder: "All environments", options: environmentOptions, selected: environmentFilter, set: setEnvironmentFilter },
    { placeholder: "All branches", options: branchOptions, selected: branchFilter, set: setBranchFilter },
    { placeholder: "All repositories", options: repositoryOptions, selected: repositoryFilter, set: setRepositoryFilter },
    { placeholder: "All workflows", options: workflowOptions, selected: workflowFilter, set: setWorkflowFilter },
  ];

  const addFilterValue = (values: string[], set: (next: string[]) => void) => (value: string) => {
    const v = value.trim();
    if (v !== "" && !values.includes(v)) {
      set([...values, v]);
    }
  };

  const visibleGates = useMemo(() => {
    const environments = new Set(environmentFilter);
    const branches = new Set(branchFilter);
    const repositories = new Set(repositoryFilter);
    const workflows = new Set(workflowFilter);
    // AND across filter kinds, OR within a kind; empty means no constraint.
    return (gates ?? []).filter((g) =>
      (environments.size === 0 || environments.has(g.environmentName)) &&
      (branches.size === 0 || branches.has(g.headBranch)) &&
      (repositories.size === 0 || repositories.has(gateRepoName(g))) &&
      (workflows.size === 0 || workflows.has(g.workflowName)));
  }, [gates, environmentFilter, branchFilter, repositoryFilter, workflowFilter]);
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

  const emptyMessage = (gates?.length ?? 0) > 0
    ? "No gates match the current filters."
    : "No deployment gates are waiting for approval.";

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
      id: "select",
      header: () => <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={approvable.length === 0 || isApproving} />,
      cell: ({ row }) => <input type="checkbox" checked={selected.has(gateKey(row))} onChange={() => toggleSelection(row)} disabled={!row.currentUserCanApprove || isApproving} />,
      enableSorting: false,
    },
    {
      field: (g) => `${g.repositoryOwner}/${g.repositoryName}`,
      id: "repository",
      header: "Repository",
      enableSorting: true,
    },
    {
      field: "workflowName",
      header: "Workflow",
      cell: ({ row }) => (
        <a href={row.htmlUrl!} target="_blank" rel="noopener noreferrer">
          {row.workflowName} #{row.runNumber}
        </a>
      ),
      enableSorting: true,
    },
    {
      field: "environmentName",
      header: "Environment",
      cell: ({ row }) => <Badge className="gate-environment" pill>{row.environmentName}</Badge>,
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
      cell: ({ value }) => {
        const updatedAt = DateTime.fromISO(value as string);
        const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");
        return <span title={updatedAt.toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</span>;
      },
      enableSorting: true,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <a className="gate-open-link" href={row.htmlUrl!} target="_blank" rel="noopener noreferrer" title="Open on GitHub" aria-label="Open run on GitHub">
          <FontAwesomeIcon icon="arrow-up-right-from-square" />
        </a>
      ),
      enableSorting: false,
    },
  ], [selected, allSelected, approvable.length, isApproving]);

  if (!selectedRepositories?.some(hasDashboardWorkflows)) {
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
        <div className="filter-bar">
          {gateFilters.map((filter) => (
            <ComboBox<string>
              key={filter.placeholder}
              className="filter-combo"
              placeholder={filter.placeholder}
              multiSelect
              clearable
              creatable
              createLabel={(input) => `Add "${input.trim()}"`}
              items={filter.options}
              selectedItems={filter.selected}
              labelField={(value) => value}
              valueField={(value) => value}
              onCreate={addFilterValue(filter.selected, filter.set)}
              onChange={filter.set}
            />
          ))}
        </div>
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

      {isNarrow ? (
        <GateCards
          gates={visibleGates}
          gateKey={gateKey}
          selected={selected}
          onToggle={toggleSelection}
          disabled={isApproving}
          loading={isLoading}
          emptyMessage={emptyMessage}
        />
      ) : (
        <DataGrid
          className="gate-table"
          data={visibleGates}
          columns={columns}
          sortable
          loading={isLoading}
          emptyMessage={emptyMessage}
        />
      )}
    </article>
  );
};
