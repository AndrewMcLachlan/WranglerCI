import { describe, it, expect } from "vitest";
import { applyPendingGates, gatesAheadOfDashboard, pendingGatesForRun, restoreFailedApprovals, withoutApprovedGates, withoutGatesForRun } from "./gateStatus";
import type { DeploymentGateModel, GateApprovalResult, GateRef, RepositoryModel, WorkflowRunModel } from "../api";

const run = (overrides: Partial<WorkflowRunModel> = {}): WorkflowRunModel => ({
  id: 1,
  workflowId: 10,
  nodeId: "run",
  conclusion: null,
  headBranch: "release",
  event: "push",
  runNumber: 7,
  status: "in_progress",
  createdAt: "2026-09-23T00:00:00Z",
  updatedAt: "2026-09-23T00:00:00Z",
  htmlUrl: "https://github.com/acme/site/actions/runs/1",
  workflowStatus: "Running",
  ...overrides,
});

const repositories = (runs: WorkflowRunModel[]): RepositoryModel[] => [{
  name: "site",
  owner: "acme",
  ownerName: "Acme",
  nodeId: "repo",
  htmlUrl: "https://github.com/acme/site",
  overallStatus: "Running",
  workflows: [{ id: 10, nodeId: "wf", name: "Deploy", htmlUrl: "", overallStatus: "Running", runs }],
}];

const gate = (overrides: Partial<DeploymentGateModel> = {}): DeploymentGateModel => ({
  repositoryOwner: "acme",
  repositoryName: "site",
  workflowRunId: 1,
  runNumber: 7,
  workflowName: "Deploy",
  headBranch: "release",
  event: "push",
  htmlUrl: "",
  createdAt: "2026-09-23T00:00:00Z",
  updatedAt: "2026-09-23T00:00:00Z",
  environmentId: 100,
  environmentName: "Production",
  currentUserCanApprove: true,
  ...overrides,
});

describe("pendingGatesForRun", () => {
  it("finds the gates holding a run, whether its id is a number or a string", () => {
    expect(pendingGatesForRun([gate({ workflowRunId: "1" })], run())).toHaveLength(1);
  });

  it("offers nothing for a run that has finished", () => {
    const finished = run({ status: "completed", conclusion: "success", workflowStatus: "Green" });

    expect(pendingGatesForRun([gate()], finished)).toHaveLength(0);
  });

  it("offers nothing for a gate the user cannot approve", () => {
    expect(pendingGatesForRun([gate({ currentUserCanApprove: false })], run())).toHaveLength(0);
  });
});

describe("applyPendingGates", () => {
  it("shows a run with a pending gate as waiting, whatever was last heard", () => {
    const result = applyPendingGates(repositories([run()]), [gate()]);

    expect(result[0].workflows?.[0].runs?.[0].workflowStatus).toBe("Waiting");
    expect(result[0].workflows?.[0].overallStatus).toBe("Waiting");
    expect(result[0].overallStatus).toBe("Waiting");
  });

  it("counts a gate whatever the viewer's right to approve it", () => {
    const result = applyPendingGates(repositories([run()]), [gate({ currentUserCanApprove: false })]);

    expect(result[0].workflows?.[0].runs?.[0].workflowStatus).toBe("Waiting");
  });

  it("leaves a finished run alone, however stale the gate list", () => {
    const finished = run({ status: "completed", conclusion: "success", workflowStatus: "Green" });

    const result = applyPendingGates(repositories([finished]), [gate()]);

    expect(result[0].workflows?.[0].runs?.[0].workflowStatus).toBe("Green");
  });

  it("returns the same data when no gate applies, so nothing re-renders for it", () => {
    const data = repositories([run()]);

    expect(applyPendingGates(data, [gate({ workflowRunId: 999 })])).toBe(data);
    expect(applyPendingGates(data, [])).toBe(data);
  });
});

describe("gatesAheadOfDashboard", () => {
  it("flags a gate for a run on a shown branch that the dashboard is not showing", () => {
    const shown = run({ id: 1, status: "completed", conclusion: "success", workflowStatus: "Green" });

    expect(gatesAheadOfDashboard(repositories([shown]), [gate({ workflowRunId: 2 })])).toEqual(["2"]);
  });

  it("ignores a gate for the run already shown", () => {
    expect(gatesAheadOfDashboard(repositories([run()]), [gate({ workflowRunId: 1 })])).toEqual([]);
  });

  it("ignores a gate on a branch the dashboard is not showing", () => {
    expect(gatesAheadOfDashboard(repositories([run()]), [gate({ workflowRunId: 2, headBranch: "feature/x" })])).toEqual([]);
  });

  it("ignores a gate for a repository not on the dashboard", () => {
    expect(gatesAheadOfDashboard(repositories([run()]), [gate({ workflowRunId: 2, repositoryName: "other" })])).toEqual([]);
  });
});

describe("withoutGatesForRun", () => {
  it("drops every environment for a finished run", () => {
    const gates = [gate({ environmentId: 1 }), gate({ environmentId: 2 }), gate({ workflowRunId: 5 })];

    expect(withoutGatesForRun(gates, "1")).toEqual([gate({ workflowRunId: 5 })]);
  });

  it("returns the same list when the run had no gates", () => {
    const gates = [gate()];

    expect(withoutGatesForRun(gates, 999)).toBe(gates);
  });
});

const ref = (gate: DeploymentGateModel): GateRef => ({
  owner: gate.repositoryOwner,
  repo: gate.repositoryName,
  runId: gate.workflowRunId,
  environmentId: gate.environmentId,
  environmentName: gate.environmentName,
});

const result = (gate: DeploymentGateModel, approved: boolean): GateApprovalResult => ({
  repositoryOwner: gate.repositoryOwner,
  repositoryName: gate.repositoryName,
  workflowRunId: gate.workflowRunId,
  environmentName: gate.environmentName,
  approved,
});

describe("withoutApprovedGates", () => {
  it("drops exactly the gates being approved, matching ids as text", () => {
    const production = gate({ environmentId: 1, environmentName: "Production" });
    const staging = gate({ environmentId: 2, environmentName: "Staging" });

    expect(withoutApprovedGates([production, staging], [{ ...ref(production), runId: "1", environmentId: "1" }])).toEqual([staging]);
  });

  it("matches the repository whatever its case", () => {
    expect(withoutApprovedGates([gate()], [{ ...ref(gate()), owner: "ACME", repo: "Site" }])).toEqual([]);
  });

  it("returns the same list when none of them are being approved", () => {
    const gates = [gate()];

    expect(withoutApprovedGates(gates, [ref(gate({ workflowRunId: 99 }))])).toBe(gates);
  });
});

describe("restoreFailedApprovals", () => {
  it("puts back a gate whose approval failed", () => {
    const failed = gate({ environmentId: 1, environmentName: "Production" });
    const approved = gate({ environmentId: 2, environmentName: "Staging" });

    expect(restoreFailedApprovals([], [failed, approved], [result(failed, false), result(approved, true)])).toEqual([failed]);
  });

  it("leaves the list alone when every approval succeeded", () => {
    const current: DeploymentGateModel[] = [];

    expect(restoreFailedApprovals(current, [gate()], [result(gate(), true)])).toBe(current);
  });

  it("does not duplicate a failed gate a refetch already brought back", () => {
    const failed = gate();

    expect(restoreFailedApprovals([failed], [failed], [result(failed, false)])).toEqual([failed]);
  });
});
