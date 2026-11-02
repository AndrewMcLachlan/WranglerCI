import type { WorkflowStatus } from "../../../../api";

/** The colour class for a run status. Amber covers cancelled, skipped and action_required runs, shown grey. */
export const statusClassName = (status?: WorkflowStatus): string | undefined =>
  status === "Amber" ? "grey" : status?.toLowerCase();

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {

  return (
    <span className={`status-indicator ${statusClassName(status)}`} />
  );
}

interface StatusIndicatorProps {
  status?: WorkflowStatus;
}

export default StatusIndicator;
