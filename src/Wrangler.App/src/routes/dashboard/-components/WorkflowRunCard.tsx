import { Icon } from "@andrewmclachlan/moo-ds";
import type { WorkflowRunModel } from "../../../api";
import { Badge } from "./Badge";
import RagStatus from "./RagStatus";
import { DateTime } from "luxon";

export const WorkflowRunCard: React.FC<WorkflowRunCardProps> = ({ workflowRun }) => {

  const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: 'long' });

  const updatedAt = DateTime.fromISO(workflowRun.updatedAt!);
  const timeAgo = updatedAt.toRelative({ style: 'long' }) || formatter.format(0, 'seconds');

  return (
    <section className="workflow-run-card">
      <RagStatus ragStatus={workflowRun.ragStatus} />
      <span className="conclusion">{workflowRun.conclusion}</span>
      <Badge>{workflowRun.headBranch}</Badge>
      <span>{workflowRun.event}</span>
      <span>{workflowRun.runNumber}</span>
      <span>{workflowRun.triggeringActor}</span>

      <span className={`run-status ${workflowRun.status}`}>{workflowRun.status}</span>
      <span className="run-timestamp" title={DateTime.fromISO(workflowRun.updatedAt!).toFormat('yyyy-MM-dd HH:mm:ss')}>{timeAgo}</span>
      <span><a href={workflowRun.htmlUrl!} target="_blank"><Icon icon="arrow-up-right-from-square" /></a></span>
    </section>
  );
}

interface WorkflowRunCardProps {
  workflowRun: WorkflowRunModel;
}
