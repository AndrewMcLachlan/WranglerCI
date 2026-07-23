import { useMemo } from "react";
import { ComboBox } from "@andrewmclachlan/moo-ds";
import { useDashboardContext } from "../../-providers/DashboardProvider";

interface BranchOption {
  name: string;
}

export const Filters = () => {

  const { branchFilter, addBranchFilter, setBranchFilter } = useDashboardContext();

  const selectedBranches = useMemo<BranchOption[]>(() => branchFilter.map((name) => ({ name })), [branchFilter]);

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <span className="filter-label">Branches</span>
        <ComboBox<BranchOption>
          className="filter-combo"
          placeholder="Add branches..."
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
      </div>
    </div>
  );
}
