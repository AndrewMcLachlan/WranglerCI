import { CloseBadge } from "@andrewmclachlan/moo-ds";
import { useDashboardContext } from "../-providers/DashboardProvider";

export const Filters = () => {

  const { branchFilter, addBranchFilter, removeBranchFilter } = useDashboardContext();

  const checkInput = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {

    if (e.type === "keyup") {
      const keyEvent = e as React.KeyboardEvent<HTMLInputElement>;
      if (keyEvent.key !== "Enter" && keyEvent.key !== " " && keyEvent.key !== "," && keyEvent.key !== ";") {
        return;
      }
    }

    e.preventDefault();
    if (e.currentTarget.value.trim() !== "") {
      addBranchFilter(e.currentTarget.value.trim());
      e.currentTarget.value = "";

    }
  }

  // TODO: Branch filters are changing.
  return null;

  return (
    <div className="filters">
      <input type="text" className="form-control branch-filter" placeholder="Branches" onKeyUp={checkInput} onBlur={checkInput} />

      <div className="branch-badges">
        {branchFilter?.map((branch) => (
          <CloseBadge key={branch} onClose={() => removeBranchFilter(branch)}>{branch}</CloseBadge>))
        }
      </div>
    </div>
  );
}
