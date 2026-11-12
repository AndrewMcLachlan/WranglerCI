import { describe, expect, it } from "vitest";
import type { WorkflowModel } from "../../../../api";
import { withPending } from "./withPending";

const workflow = (name: string): WorkflowModel => ({ id: name, nodeId: name, name, htmlUrl: "" });

const names = (items: ReturnType<typeof withPending>) => items.map((i) => i.workflow?.name ?? `(${i.pending?.name ?? "?"})`);

describe("withPending", () => {
  it("places a pending workflow where its name falls", () => {
    expect(names(withPending([workflow("Build"), workflow("Deploy")], [{ id: 1, name: "CodeQL" }]))).toEqual(["Build", "(CodeQL)", "Deploy"]);
  });

  it("places pending workflows after every workflow when their names sort last", () => {
    expect(names(withPending([workflow("Build")], [{ id: 1, name: "Test" }, { id: 2, name: "Release" }]))).toEqual(["Build", "(Release)", "(Test)"]);
  });

  it("puts a pending workflow whose name isn't known last", () => {
    expect(names(withPending([workflow("Build"), workflow("Deploy")], [{ id: 1 }, { id: 2, name: "A" }]))).toEqual(["(A)", "Build", "Deploy", "(?)"]);
  });
});
