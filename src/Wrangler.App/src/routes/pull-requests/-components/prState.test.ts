import { describe, expect, it } from "vitest";
import type { PullRequestModel } from "../../../api";
import { prState } from "./prState";

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
