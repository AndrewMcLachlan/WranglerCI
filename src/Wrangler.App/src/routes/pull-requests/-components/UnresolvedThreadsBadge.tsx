import { Badge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const UnresolvedThreadsBadge: React.FC<{ count?: number | string | null }> = ({ count }) => {
  const unresolved = Number(count ?? 0);
  if (unresolved === 0) return null;

  const description = unresolved === 1 ? "1 unresolved conversation" : `${unresolved} unresolved conversations`;

  return (
    <Badge className="amber" icon={<FontAwesomeIcon icon="comment" />} title={description} aria-label={description}>
      {unresolved} unresolved
    </Badge>
  );
};
