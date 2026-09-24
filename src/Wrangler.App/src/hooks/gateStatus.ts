import { worstStatus } from "./mergeWorkflowRun";
import type { DeploymentGateModel, GateApprovalResult, GateRef, RepositoryModel, WorkflowModel, WorkflowRunModel } from "../api";

const isForRun = (gate: DeploymentGateModel, runId: number | string): boolean =>
  String(gate.workflowRunId) === String(runId);

const isFinished = (run: WorkflowRunModel): boolean => !!run.conclusion;

const sameRepo = (gate: DeploymentGateModel, repo: RepositoryModel): boolean =>
  gate.repositoryOwner.toLowerCase() === repo.owner.toLowerCase() &&
  gate.repositoryName.toLowerCase() === repo.name.toLowerCase();

/** The gates holding this run that the current user can approve. */
export const pendingGatesForRun = (gates: DeploymentGateModel[], run: WorkflowRunModel): DeploymentGateModel[] =>
  isFinished(run) ? [] : gates.filter((gate) => isForRun(gate, run.id) && gate.currentUserCanApprove);

/** Marks every unfinished run with a pending gate as Waiting, rolling the status up. */
export const applyPendingGates = (repositories: RepositoryModel[], gates: DeploymentGateModel[]): RepositoryModel[] => {
  if (gates.length === 0) return repositories;

  let changed = false;

  const updated = repositories.map((repo) => {
    let repoChanged = false;

    const workflows = repo.workflows?.map((workflow): WorkflowModel => {
      let workflowChanged = false;

      const runs = workflow.runs?.map((run) => {
        if (isFinished(run) || run.workflowStatus === "Waiting") return run;
        if (!gates.some((gate) => isForRun(gate, run.id))) return run;
        workflowChanged = true;
        return { ...run, workflowStatus: "Waiting" as const };
      });

      if (!workflowChanged) return workflow;
      repoChanged = true;
      return { ...workflow, runs, overallStatus: worstStatus(runs?.map((r) => r.workflowStatus) ?? []) };
    });

    if (!repoChanged) return repo;
    changed = true;
    return { ...repo, workflows, overallStatus: worstStatus(workflows?.map((w) => w.overallStatus) ?? []) };
  });

  return changed ? updated : repositories;
};

/**
 * Run ids of gates on a workflow and branch the dashboard shows, but for a run
 * it is not showing: evidence of a newer run the dashboard has not fetched.
 */
export const gatesAheadOfDashboard = (repositories: RepositoryModel[], gates: DeploymentGateModel[]): string[] =>
  gates
    .filter((gate) => repositories.some((repo) => sameRepo(gate, repo) && repo.workflows?.some((workflow) =>
      workflow.name === gate.workflowName &&
      workflow.runs?.some((run) => run.headBranch === gate.headBranch) &&
      !workflow.runs.some((run) => isForRun(gate, run.id)))))
    .map((gate) => String(gate.workflowRunId));

export const withoutGatesForRun = (gates: DeploymentGateModel[], runId: number | string): DeploymentGateModel[] =>
  gates.some((gate) => isForRun(gate, runId)) ? gates.filter((gate) => !isForRun(gate, runId)) : gates;

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const isRef = (gate: DeploymentGateModel, ref: GateRef): boolean =>
  sameName(gate.repositoryOwner, ref.owner) &&
  sameName(gate.repositoryName, ref.repo) &&
  isForRun(gate, ref.runId) &&
  String(gate.environmentId) === String(ref.environmentId);

const isResultFor = (gate: DeploymentGateModel, result: GateApprovalResult): boolean =>
  sameName(gate.repositoryOwner, result.repositoryOwner) &&
  sameName(gate.repositoryName, result.repositoryName) &&
  isForRun(gate, result.workflowRunId) &&
  gate.environmentName === result.environmentName;

/** The gate list as it will be once these approvals go through. */
export const withoutApprovedGates = (gates: DeploymentGateModel[], approving: GateRef[]): DeploymentGateModel[] =>
  gates.some((gate) => approving.some((ref) => isRef(gate, ref)))
    ? gates.filter((gate) => !approving.some((ref) => isRef(gate, ref)))
    : gates;

/** Puts back the gates from before the approval whose results say it failed. */
export const restoreFailedApprovals = (
  current: DeploymentGateModel[],
  previous: DeploymentGateModel[],
  results: GateApprovalResult[],
): DeploymentGateModel[] => {
  const failed = previous.filter((gate) =>
    results.some((result) => !result.approved && isResultFor(gate, result)) &&
    !current.some((existing) => isForRun(existing, gate.workflowRunId) && String(existing.environmentId) === String(gate.environmentId)));
  return failed.length === 0 ? current : [...current, ...failed];
};
