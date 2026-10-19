import { useState, type ReactNode } from "react";
import { Drawer, FilterBar, FilterChip } from "@andrewmclachlan/moo-ds";

export interface AppliedFilter {
  /** Unique within a page — a filter kind and its value. */
  key: string;
  label: ReactNode;
  onRemove: () => void;
}

interface NarrowFiltersProps {
  /** The filter worth keeping on the bar itself; the rest live in the sheet. */
  primary?: ReactNode;
  applied: AppliedFilter[];
  /** False leaves the applied filters to the sheet, so the bar is just the button. */
  showApplied?: boolean;
  onClearAll: () => void;
  /** The full set of filter controls, shown in the sheet. */
  children: ReactNode;
}

/**
 * The narrow-viewport filter surface: a FilterBar over a bottom Drawer holding
 * the controls, with everything applied shown as chips.
 */
export const NarrowFilters: React.FC<NarrowFiltersProps> = ({ primary, applied, showApplied = true, onClearAll, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <FilterBar
        primary={primary}
        activeCount={applied.length}
        onOpenFilters={() => setOpen(true)}
        onClear={applied.length > 0 ? onClearAll : undefined}
      >
        {/* Must be null, not false: FilterBar counts a false child as a chip and shows the chip row. */}
        {showApplied ? applied.map((filter) => (
          <FilterChip key={filter.key} onRemove={filter.onRemove}>{filter.label}</FilterChip>
        )) : null}
      </FilterBar>
      <Drawer show={open} onHide={() => setOpen(false)} placement="bottom" className="filter-drawer">
        <Drawer.Header closeButton onHide={() => setOpen(false)}>
          <h3>Filters</h3>
        </Drawer.Header>
        <Drawer.Body>
          {children}
        </Drawer.Body>
      </Drawer>
    </>
  );
};
