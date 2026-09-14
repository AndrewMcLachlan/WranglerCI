import { Badge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DateTime } from "luxon";
import { RowCard } from "../../../components/RowCard";
import type { DeploymentGateModel } from "../../../api";

interface GateCardsProps {
  gates: DeploymentGateModel[];
  gateKey: (gate: DeploymentGateModel) => string;
  selected: Set<string>;
  onToggle: (gate: DeploymentGateModel) => void;
  disabled: boolean;
  loading: boolean;
  emptyMessage: string;
}

const relative = (iso?: string | null) => {
  if (!iso) return "—";
  return DateTime.fromISO(iso).toRelative({ style: "long" }) ?? "just now";
};

/** The narrow-viewport rendering of the deployment gates table. */
export const GateCards: React.FC<GateCardsProps> = ({
  gates, gateKey, selected, onToggle, disabled, loading, emptyMessage,
}) => {
  if (loading) return <p className="row-card-message">Loading...</p>;
  if (gates.length === 0) return <p className="row-card-message">{emptyMessage}</p>;

  return (
    <div className="row-card-list">
      {gates.map((gate) => (
        <RowCard
          key={gateKey(gate)}
          onSelect={() => onToggle(gate)}
          selected={selected.has(gateKey(gate))}
          selectDisabled={!gate.currentUserCanApprove || disabled}
          selectLabel={`Select ${gate.workflowName} for ${gate.environmentName}`}
          title={
            <a href={gate.htmlUrl!} target="_blank" rel="noopener noreferrer">
              {gate.workflowName} #{gate.runNumber}
            </a>
          }
          meta={<Badge className="gate-environment" pill>{gate.environmentName}</Badge>}
          details={[
            { label: "Repository", value: `${gate.repositoryOwner}/${gate.repositoryName}` },
            { label: "Branch", value: gate.headBranch },
            { label: "Updated", value: relative(gate.updatedAt) },
          ]}
          actions={
            <a
              className="gate-open-link"
              href={gate.htmlUrl!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open run on GitHub"
            >
              <FontAwesomeIcon icon="arrow-up-right-from-square" /> Open on GitHub
            </a>
          }
        />
      ))}
    </div>
  );
};
