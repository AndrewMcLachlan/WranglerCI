import { Badge } from "../../dashboard/-components/shared/Badge";

const statusMap: Record<string, { label: string; className: string }> = {
  Success: { label: "Success", className: "green" },
  Failure: { label: "Failure", className: "red" },
  Pending: { label: "Pending", className: "amber" },
};

export const CheckStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const mapped = statusMap[status ?? ""] ?? { label: status ?? "Unknown", className: "" };

  return <Badge className={mapped.className}>{mapped.label}</Badge>;
};
