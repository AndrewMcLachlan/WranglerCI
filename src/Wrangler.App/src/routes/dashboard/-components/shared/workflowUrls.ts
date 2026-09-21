import type { WorkflowModel, WorkflowRunModel } from "../../../../api";

/**
 * A workflow's runs on GitHub.
 *
 * `workflow.htmlUrl` points at the definition in the repository
 * (`/blob/main/.github/workflows/x.yml`); the runs live at
 * `/actions/workflows/x.yml`.
 */
export const workflowActionsUrl = (workflow: WorkflowModel): string | undefined =>
    workflow.htmlUrl?.replace("blob/main/.github", "actions");

/** The repository's own Actions page, from a run's URL. */
const repoActionsUrl = (run: WorkflowRunModel): string | undefined => {
    const repoBase = run.htmlUrl?.split("/actions/")[0];
    return repoBase ? `${repoBase}/actions` : undefined;
};

/**
 * Runs on a branch: this workflow's when one is known, otherwise the
 * repository's across every workflow.
 */
export const branchRunsUrl = (run: WorkflowRunModel, workflow?: WorkflowModel): string | undefined => {
    const base = (workflow && workflowActionsUrl(workflow)) ?? repoActionsUrl(run);
    if (!base || !run.headBranch) return undefined;

    return `${base}?query=${encodeURIComponent(`branch:${run.headBranch}`)}`;
};
