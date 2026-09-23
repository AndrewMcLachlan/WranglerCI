import { useState } from "react";
import { Button, Modal } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { toast } from "react-toastify";
import { useGates } from "../../../gates/-hooks/useGates";
import { useApproveGates } from "../../../gates/-hooks/useApproveGates";
import { pendingGatesForRun } from "../../../../hooks/gateStatus";
import type { DeploymentGateModel, WorkflowRunModel } from "../../../../api";

const toGateRef = (gate: DeploymentGateModel) => ({
  owner: gate.repositoryOwner,
  repo: gate.repositoryName,
  runId: gate.workflowRunId,
  environmentId: gate.environmentId,
  environmentName: gate.environmentName,
});

/**
 * Approves the deployment gates holding a run up, from wherever the run is
 * shown. Renders nothing unless this run has gates the current user can
 * approve.
 */
export const GateApproval: React.FC<{ run: WorkflowRunModel }> = ({ run }) => {
  const { data: gates } = useGates();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);

  const { mutate: approveGates, isPending } = useApproveGates({
    onResults: (results) => {
      for (const result of results) {
        if (result.approved) {
          toast.success(`${result.repositoryOwner}/${result.repositoryName} · ${result.environmentName}: Approved`);
        } else {
          toast.error(`${result.repositoryOwner}/${result.repositoryName} · ${result.environmentName}: ${result.error ?? "Failed"}`);
        }
      }
      setOpen(false);
    },
  });

  const pending = pendingGatesForRun(gates ?? [], run);
  if (pending.length === 0) return null;

  const openDialog = () => {
    setChosen(pending.map((gate) => String(gate.environmentId)));
    setOpen(true);
  };

  const toggle = (environmentId: string) =>
    setChosen((current) => current.includes(environmentId)
      ? current.filter((id) => id !== environmentId)
      : [...current, environmentId]);

  const selected = pending.filter((gate) => chosen.includes(String(gate.environmentId)));

  return (
    <>
      <button
        type="button"
        className="gate-approve"
        onClick={openDialog}
        title={`Approve ${pending.map((g) => g.environmentName).join(", ")}`}
        aria-label={`Approve deployment to ${pending.map((g) => g.environmentName).join(", ")}`}
      >
        <FontAwesomeIcon icon="circle-check" />
      </button>

      <Modal show={open} onHide={() => setOpen(false)}>
        <Modal.Header closeButton onHide={() => setOpen(false)}>
          <Modal.Title>Approve deployment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pending.length === 1 ? (
            <p>
              Approve <strong>{pending[0].workflowName}</strong> #{pending[0].runNumber} to{" "}
              <strong>{pending[0].environmentName}</strong>?
            </p>
          ) : (
            <>
              <p>
                <strong>{pending[0].workflowName}</strong> #{pending[0].runNumber} is waiting on{" "}
                {pending.length} environments. Choose which to approve:
              </p>
              <ul className="gate-approve-environments">
                {pending.map((gate) => (
                  <li key={String(gate.environmentId)}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chosen.includes(String(gate.environmentId))}
                        onChange={() => toggle(String(gate.environmentId))}
                      />
                      {gate.environmentName}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => approveGates(selected.map(toGateRef))}
            disabled={selected.length === 0 || isPending}
          >
            {isPending ? "Approving..." : "Approve"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
