import { useMemo } from "react";
import { ComboBox } from "@andrewmclachlan/moo-ds";
import { useDashboardContext } from "../../-providers/DashboardProvider";
import { useDashboardStatusFilter } from "../../-hooks/useDashboardStatusFilter";
import { dotLabel, optionSearch } from "../../../../components/filters/filterOptions";
import type { WorkflowStatus } from "../../../../api";

interface BranchOption {
  name: string;
}

// Statuses a run can carry, minus "None" (no run / nothing to filter on).
const STATUS_OPTIONS: WorkflowStatus[] = ["Green", "Red", "Amber", "Running", "Waiting"];

const statusLabel = dotLabel<WorkflowStatus>((s) => s.toLowerCase(), (s) => s);
const statusSearch = optionSearch<WorkflowStatus>(STATUS_OPTIONS, (s) => s);

export const Filters = () => {

  const { branchFilter, addBranchFilter, setBranchFilter } = useDashboardContext();
  const [statusFilter, setStatusFilter] = useDashboardStatusFilter();

  const selectedBranches = useMemo<BranchOption[]>(() => branchFilter.map((name) => ({ name })), [branchFilter]);

  return (
    <div className="filter-bar">
      <ComboBox<BranchOption>
        className="filter-combo"
        placeholder="All branches"
        multiSelect
        clearable
        creatable
        createLabel={(input) => `Add "${input.trim()}"`}
        items={[]}
        selectedItems={selectedBranches}
        labelField={(b) => b.name}
        valueField={(b) => b.name}
        onCreate={(name) => name.trim() !== "" && addBranchFilter(name.trim())}
        onChange={(items) => setBranchFilter(items.map((b) => b.name))}
      />
      <ComboBox<WorkflowStatus>
        className="filter-combo"
        placeholder="Any status"
        multiSelect
        clearable
        items={STATUS_OPTIONS}
        selectedItems={statusFilter}
        labelField={statusLabel}
        valueField={(s) => s}
        search={statusSearch}
        onChange={(items) => setStatusFilter(items)}
      />
    </div>
  );
}
