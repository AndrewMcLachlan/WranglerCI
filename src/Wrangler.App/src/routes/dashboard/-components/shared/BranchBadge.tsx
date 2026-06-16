import type { MouseEventHandler } from "react";
import type { WorkflowRunModel } from "../../../../api";
import { Badge } from "./Badge";

// run.htmlUrl looks like https://github.com/{owner}/{repo}/actions/runs/{id}.
// The repo base is everything before /actions/, which we turn into the Actions
// list filtered to the run's head branch.
const actionsUrl = (run: WorkflowRunModel): string | undefined => {
  const repoBase = run.htmlUrl?.split("/actions/")[0];
  if (!repoBase || !run.headBranch) return undefined;
  const query = encodeURIComponent(`branch:${run.headBranch}`);
  return `${repoBase}/actions?query=${query}`;
};

export const BranchBadge: React.FC<{ run: WorkflowRunModel; className?: string }> = ({ run, className }) => {
  const url = actionsUrl(run);
  const badge = <Badge className={className}>{run.headBranch}</Badge>;

  if (!url) return badge;

  // stopPropagation keeps the badge from triggering an enclosing run link.
  const onClick: MouseEventHandler = (e) => e.stopPropagation();

  return (
    <a
      className="branch-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View workflow runs for ${run.headBranch}`}
      onClick={onClick}
    >
      {badge}
    </a>
  );
};
