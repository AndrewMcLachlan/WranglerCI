import type { WorkflowModel } from "../../../../api";
import type { PendingWorkflow } from "../../-hooks/useWorkflows";

export type WorkflowItem = { workflow: WorkflowModel; pending?: never } | { pending: PendingWorkflow; workflow?: never };

const itemName = (item: WorkflowItem) => item.workflow?.name ?? item.pending?.name;

/** Places each pending workflow where its name falls among the workflows; one whose name isn't known yet goes last. */
export const withPending = (workflows: WorkflowModel[], pending: PendingWorkflow[] = []): WorkflowItem[] => {
  const items: WorkflowItem[] = workflows.map((workflow) => ({ workflow }));
  for (const p of pending) {
    const name = p.name;
    const at = name === undefined ? -1 : items.findIndex((item) => {
      const other = itemName(item);
      return other === undefined || other.localeCompare(name) > 0;
    });
    if (at < 0) items.push({ pending: p });
    else items.splice(at, 0, { pending: p });
  }
  return items;
};

export const workflowItemKey = (item: WorkflowItem) => item.workflow ? String(item.workflow.id) : `pending:${item.pending.id}`;
