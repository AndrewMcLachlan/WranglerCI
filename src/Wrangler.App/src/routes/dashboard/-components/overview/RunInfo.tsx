import { DateTime } from "luxon";
import type { WorkflowRunModel } from "../../../../api";
import StatusIndicator from "../shared/StatusIndicator";
import { BranchBadge } from "../shared/BranchBadge";
import classNames from "classnames";

export const RunInfo: React.FC<{ run: WorkflowRunModel; orientation?: "left" | "right" }> = ({ run, orientation = "left" }) => {
  const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });
  const timeAgo = DateTime.fromISO(run.updatedAt).toRelative({ style: "long" }) || formatter.format(0, "seconds");

  return (
    <div className={classNames("workflow-run-info", orientation)}>
      {orientation === "left" && <StatusIndicator status={run.workflowStatus} />}
      <BranchBadge run={run} className="branch" />
      <a
        className="workflow-time"
        href={run.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={DateTime.fromISO(run.updatedAt).toFormat("yyyy-MM-dd HH:mm:ss")}
      >
        {timeAgo}
      </a>
      {orientation === "right" && <StatusIndicator status={run.workflowStatus} />}
    </div>
  );
};
