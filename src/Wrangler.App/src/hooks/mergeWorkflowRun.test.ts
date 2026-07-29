import { describe, it, expect } from "vitest";
import { mergeWorkflowRun } from "./mergeWorkflowRun";
import type { RepositoryModel, WorkflowRunModel } from "../api";

const makeRun = (overrides: Partial<WorkflowRunModel> = {}): WorkflowRunModel => ({
  id: 1,
  workflowId: 10,
  nodeId: "run-node",
  conclusion: null,
  headBranch: "main",
  event: "push",
  runNumber: 1,
  status: "in_progress",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  htmlUrl: "https://github.com/acme/widget/actions/runs/1",
  workflowStatus: "Running",
  ...overrides,
});

const makeRepositories = (): RepositoryModel[] => [
  {
    name: "widget",
    owner: "acme",
    nodeId: "repo-widget",
    htmlUrl: "https://github.com/acme/widget",
    overallStatus: "Green",
    workflows: [
      {
        id: 10,
        nodeId: "wf-10",
        name: "CI",
        htmlUrl: "",
        overallStatus: "Green",
        runs: [makeRun({ id: 1, workflowId: 10, workflowStatus: "Green", status: "completed", conclusion: "success" })],
      },
      {
        id: 20,
        nodeId: "wf-20",
        name: "Deploy",
        htmlUrl: "",
        overallStatus: "Green",
        runs: [makeRun({ id: 2, workflowId: 20, workflowStatus: "Green", status: "completed", conclusion: "success" })],
      },
    ],
  },
  {
    name: "gizmo",
    owner: "acme",
    nodeId: "repo-gizmo",
    htmlUrl: "https://github.com/acme/gizmo",
    overallStatus: "Green",
    workflows: [
      {
        id: 30,
        nodeId: "wf-30",
        name: "CI",
        htmlUrl: "",
        overallStatus: "Green",
        runs: [],
      },
    ],
  },
];

describe("mergeWorkflowRun", () => {
  it("replaces the workflow's run and recomputes workflow + repo overallStatus", () => {
    const repos = makeRepositories();
    const run = makeRun({ id: 99, workflowId: 10, headBranch: "main", workflowStatus: "Red", status: "completed", conclusion: "failure" });

    const result = mergeWorkflowRun(repos, "acme", "widget", run, []);

    expect(result).not.toBe(repos);
    const widget = result.find((r) => r.name === "widget")!;
    const ci = widget.workflows!.find((w) => w.id === 10)!;
    expect(ci.runs).toEqual([run]);
    expect(ci.overallStatus).toBe("Red");
    expect(widget.overallStatus).toBe("Red");

    // Untouched sibling repo and sibling workflow keep referential identity.
    expect(result.find((r) => r.name === "gizmo")).toBe(repos[1]);
    expect(widget.workflows!.find((w) => w.id === 20)).toBe(repos[0].workflows![1]);
  });

  it("leaves input unchanged when the run's branch does not match the filter", () => {
    const repos = makeRepositories();
    const run = makeRun({ id: 99, workflowId: 10, headBranch: "feature/other" });

    const result = mergeWorkflowRun(repos, "acme", "widget", run, ["main"]);

    expect(result).toBe(repos);
  });

  it("leaves input unchanged when owner/repo isn't in the list", () => {
    const repos = makeRepositories();
    const run = makeRun({ id: 99, workflowId: 10, headBranch: "main" });

    const result = mergeWorkflowRun(repos, "someoneelse", "widget", run, []);

    expect(result).toBe(repos);
  });

  it("leaves input unchanged when the repo is present but the workflow id is not", () => {
    const repos = makeRepositories();
    const run = makeRun({ id: 99, workflowId: 999, headBranch: "main" });

    const result = mergeWorkflowRun(repos, "acme", "widget", run, []);

    expect(result).toBe(repos);
  });

  it("matches owner/name case-insensitively", () => {
    const repos = makeRepositories();
    const run = makeRun({ id: 99, workflowId: 10, headBranch: "main", workflowStatus: "Amber" });

    const result = mergeWorkflowRun(repos, "ACME", "Widget", run, []);

    expect(result).not.toBe(repos);
    const widget = result.find((r) => r.name === "widget")!;
    expect(widget.workflows!.find((w) => w.id === 10)!.overallStatus).toBe("Amber");
  });

  it("matches trailing-* branch filters", () => {
    const repos = makeRepositories();
    const run = makeRun({ id: 99, workflowId: 10, headBranch: "feature/task-123" });

    const result = mergeWorkflowRun(repos, "acme", "widget", run, ["feature/*"]);

    expect(result).not.toBe(repos);
    const widget = result.find((r) => r.name === "widget")!;
    expect(widget.workflows!.find((w) => w.id === 10)!.runs).toEqual([run]);
  });

  it("recomputes repo overallStatus as the worst across all its workflows", () => {
    const repos = makeRepositories();
    // Deploy (id 20) stays Green; CI (id 10) becomes Amber -> repo worst is Amber.
    const run = makeRun({ id: 99, workflowId: 10, headBranch: "main", workflowStatus: "Amber" });

    const result = mergeWorkflowRun(repos, "acme", "widget", run, []);

    const widget = result.find((r) => r.name === "widget")!;
    expect(widget.overallStatus).toBe("Amber");
  });
});
