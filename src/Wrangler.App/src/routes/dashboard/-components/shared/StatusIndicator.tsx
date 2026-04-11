import type { WorkflowStatus } from "../../../../api";

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {

  return (
    <span className={`status-indicator ${status?.toLowerCase()}`} />
  );
}

interface StatusIndicatorProps {
  status?: WorkflowStatus;
}

export default StatusIndicator;
