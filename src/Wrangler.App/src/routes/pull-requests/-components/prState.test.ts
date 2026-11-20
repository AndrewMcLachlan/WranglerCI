import { describe, expect, it } from "vitest";
import type { PullRequestModel } from "../../../api";
import { canAutoMerge, canSelect, prState } from "./prState";

const pr = (overrides: Partial<PullRequestModel>): PullRequestModel => ({
  id: 1,
  number: 1,
  nodeId: "n",
  title: "t",
  author: "a",
  repositoryOwner: "o",
  repositoryName: "r",
  htmlUrl: "https://github.com/o/r/pull/1",
  headSha: "sha",
  headRef: "branch",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  checkStatus: "Success",
  blockers: [],
  ...overrides,
});

describe("prState", () => {
  it("is ready when checks pass and nothing blocks the merge", () => {
    expect(prState(pr({}))).toBe("ready");
  });

  it("is a draft whatever else is wrong", () => {
    expect(prState(pr({ blockers: ["Draft", "Conflict"], checkStatus: "Failure" }))).toBe("draft");
  });

  it("needs fixing when checks fail", () => {
    expect(prState(pr({ checkStatus: "Failure" }))).toBe("fix");
  });

  it.each(["Conflict", "Behind", "ChangesRequested"] as const)("needs fixing when %s", (blocker) => {
    expect(prState(pr({ blockers: [blocker, "NeedsReview"] }))).toBe("fix");
  });

  it("is waiting while checks run", () => {
    expect(prState(pr({ checkStatus: "Pending" }))).toBe("waiting");
  });

  it.each(["NeedsReview", "UnresolvedConversations", "Blocked"] as const)("is waiting when %s", (blocker) => {
    expect(prState(pr({ blockers: [blocker] }))).toBe("waiting");
  });
});

describe("canAutoMerge", () => {
  it("helps a pull request waiting on its checks", () => {
    expect(canAutoMerge(pr({ checkStatus: "Pending" }))).toBe(true);
  });

  it("does not help one already auto-merging", () => {
    expect(canAutoMerge(pr({ checkStatus: "Pending", autoMerge: true }))).toBe(false);
  });

  it("does not help one its author must fix first", () => {
    expect(canAutoMerge(pr({ checkStatus: "Failure" }))).toBe(false);
    expect(canAutoMerge(pr({ blockers: ["Conflict"] }))).toBe(false);
    expect(canAutoMerge(pr({ blockers: ["Draft"] }))).toBe(false);
  });
});

describe("canSelect", () => {
  it("selects one ready to merge even when it is already auto-merging", () => {
    expect(canSelect(pr({ autoMerge: true }))).toBe(true);
  });

  it("selects one waiting on checks", () => {
    expect(canSelect(pr({ checkStatus: "Pending" }))).toBe(true);
  });

  it("does not select one waiting on checks that is already auto-merging", () => {
    expect(canSelect(pr({ checkStatus: "Pending", autoMerge: true }))).toBe(false);
  });
});
