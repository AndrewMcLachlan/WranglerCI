import { useMemo } from "react";
import { ComboBox } from "@andrewmclachlan/moo-ds";
import { useDashboardContext } from "../../-providers/DashboardProvider";
import { dotLabel, optionSearch } from "../../../../components/filters/filterOptions";
import type { WorkflowStatus } from "../../../../api";

interface BranchOption {
  name: string;
}

// Statuses a run can carry, minus "None" (no run / nothing to filter on).
const STATUS_OPTIONS: WorkflowStatus[] = ["Green", "Red", "Amber", "Running", "Waiting"];

// Human-readable labels for the RAG status values (the enum names are
// colours). Amber covers action_required / cancelled / skipped runs.
const STATUS_NAME: Record<string, string> = {
  Green: "Success",
  Red: "Error",
  Amber: "Cancelled",
  Running: "In progress",
  Waiting: "Waiting",
};

// Solid pill colour per status — the dropdown keeps the dot cue, the selected
// pill is tinted the whole status colour (dark text set in CSS for contrast).
const STATUS_COLOUR: Record<string, string> = {
  Green: "#6bcc6b",
  Red: "#ff6b6b",
  Amber: "#e8c44a",
  Running: "cornflowerblue",
  Waiting: "orange",
};

// Dot class stays keyed on the colour (s.toLowerCase()); the label is the
// friendly name, and search matches that name.
const statusLabel = dotLabel<WorkflowStatus>((s) => s.toLowerCase(), (s) => STATUS_NAME[s]);
const statusSearch = optionSearch<WorkflowStatus>(STATUS_OPTIONS, (s) => STATUS_NAME[s]);

export const Filters = () => {

  const { branchFilter, addBranchFilter, setBranchFilter, statusFilter, setStatusFilter } = useDashboardContext();

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
    </div>
  );
}
