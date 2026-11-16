import { Badge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { CheckStatus } from "../../../api";

type IconProp = React.ComponentProps<typeof FontAwesomeIcon>["icon"];

const statusMap: Record<CheckStatus, { label: string; longLabel: string; className: string; icon: IconProp }> = {
  Success: { label: "Passed", longLabel: "Checks passed", className: "green", icon: "circle-check" },
  Failure: { label: "Failed", longLabel: "Checks failed", className: "red", icon: "times-circle" },
  Pending: { label: "Running", longLabel: "Checks running", className: "amber", icon: "clock" },
  Unknown: { label: "No checks", longLabel: "No checks", className: "grey", icon: "circle-minus" },
};

/** `long` labels the badge as being about checks, for places without a "Checks" column header. */
export const CheckStatusBadge: React.FC<{ status?: CheckStatus; long?: boolean }> = ({ status, long = false }) => {
  const mapped = statusMap[status ?? "Unknown"] ?? statusMap.Unknown;

  return <Badge className={mapped.className} icon={<FontAwesomeIcon icon={mapped.icon} />} title={mapped.longLabel}>{long ? mapped.longLabel : mapped.label}</Badge>;
};
