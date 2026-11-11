import { describe, expect, it } from "vitest";
import type { RepositoryModel, WorkflowModel } from "../../../api";
import { narrowToSelection } from "./useWorkflows";

const workflow = (id: number): WorkflowModel => ({ id, nodeId: `wf-${id}`, name: `Workflow ${id}`, htmlUrl: "" });

const repository = (workflows: WorkflowModel[]): RepositoryModel => ({
  owner: "acme",
  name: "widget",
  ownerName: "Acme",
  nodeId: "repo",
  htmlUrl: "https://github.com/acme/widget",
  workflows,
});

describe("narrowToSelection", () => {
  it("drops workflows no longer selected", () => {
    const { repositories, missing } = narrowToSelection([repository([workflow(1), workflow(2)])], [1]);

    expect(repositories[0].workflows?.map((w) => w.id)).toEqual([1]);
    expect(missing).toBe(0);
  });

  it("counts selected workflows the data has no runs for", () => {
    const { repositories, missing } = narrowToSelection([repository([workflow(1)])], [1, 2, 3]);

    expect(repositories[0].workflows?.map((w) => w.id)).toEqual([1]);
    expect(missing).toBe(2);
  });

  it("matches ids whether stored as numbers or strings", () => {
    const { repositories, missing } = narrowToSelection([repository([workflow(1)])], ["1"]);

    expect(repositories[0].workflows).toHaveLength(1);
    expect(missing).toBe(0);
  });
});
