import type { MouseEventHandler } from "react";
import { Badge } from "@andrewmclachlan/moo-ds";
import { branchRunsUrl } from "./workflowUrls";
import type { WorkflowModel, WorkflowRunModel } from "../../../../api";

interface BranchBadgeProps {
  run: WorkflowRunModel;
  /** Scopes the link to one workflow's runs; without it the link covers the repository. */
  workflow?: WorkflowModel;
  className?: string;
}

export const BranchBadge: React.FC<BranchBadgeProps> = ({ run, workflow, className }) => {
  const url = branchRunsUrl(run, workflow);
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
      title={workflow
        ? `View ${workflow.name} runs for ${run.headBranch}`
        : `View workflow runs for ${run.headBranch}`}
      onClick={onClick}
    >
      {badge}
    </a>
  );
};
