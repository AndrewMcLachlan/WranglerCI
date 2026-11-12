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
    const { repositories, added } = narrowToSelection([repository([workflow(1), workflow(2)])], [1], [1, 2]);

    expect(repositories[0].workflows?.map((w) => w.id)).toEqual([1]);
    expect(added).toEqual([]);
  });

  it("lists only the workflows selected since the data was fetched", () => {
    const { added } = narrowToSelection([repository([workflow(1)])], [1, 2, 3, 4], [1, 2, 3]);

    expect(added).toEqual([4]);
  });

  it("does not count a selected workflow that simply has no runs", () => {
    const { repositories, added } = narrowToSelection([repository([workflow(1)])], [1, 2], [1, 2]);

    expect(repositories[0].workflows).toHaveLength(1);
    expect(added).toEqual([]);
  });

  it("matches ids whether stored as numbers or strings", () => {
    const { repositories, added } = narrowToSelection([repository([workflow(1)])], ["1", 2], [1, "2"]);

    expect(repositories[0].workflows).toHaveLength(1);
    expect(added).toEqual([]);
  });
});
