import { DateTime } from "luxon";
import type { WorkflowRunModel } from "../../../../api";
import StatusIndicator from "../shared/StatusIndicator";
import { Badge } from "../shared/Badge";
import classNames from "classnames";

export const RunInfo: React.FC<{ run: WorkflowRunModel; orientation?: "left" | "right" }> = ({ run, orientation = "left" }) => {
  const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });
  const timeAgo = DateTime.fromISO(run.updatedAt).toRelative({ style: "long" }) || formatter.format(0, "seconds");

  return (
    <a className={classNames("workflow-run-info", orientation)} href={run.htmlUrl} target="_blank" rel="noopener noreferrer">
      {orientation === "left" && <StatusIndicator status={run.workflowStatus} />}
      <Badge className="branch">{run.headBranch}</Badge>
      <span className="workflow-time" title={DateTime.fromISO(run.updatedAt).toFormat("yyyy-MM-dd HH:mm:ss")}>
        {timeAgo}
      </span>
      {orientation === "right" && <StatusIndicator status={run.workflowStatus} />}
    </a>
  );
};
