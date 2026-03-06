import type { RagStatus } from "../../../api";

const RagStatusComponent: React.FC<RagStatusProps> = ({ ragStatus }) => {

  return (
    <span className={`rag-status ${ragStatus?.toLowerCase()}`} />
  );
}

interface RagStatusProps {
  ragStatus?: RagStatus;
}

export default RagStatusComponent;
