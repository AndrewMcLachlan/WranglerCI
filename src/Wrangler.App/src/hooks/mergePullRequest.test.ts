import { describe, it, expect } from "vitest";
import { mergePullRequest, removePullRequest, isSamePullRequest, type PushedPullRequest } from "./mergePullRequest";
import type { PullRequestModel } from "../api";

const makePr = (overrides: Partial<PullRequestModel> = {}): PullRequestModel => ({
  id: 1,
  number: 42,
  nodeId: "pr-node-1",
  title: "Original title",
  author: "octocat",
  repositoryOwner: "acme",
  repositoryName: "widget",
  htmlUrl: "https://github.com/acme/widget/pull/42",
  headSha: "aaa111",
  headRef: "feature/original",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  checkStatus: "Pending",
  mergeable: true,
  labels: [{ name: "bug", color: "ff0000" }],
  ...overrides,
});

const makePushed = (overrides: Partial<PushedPullRequest> = {}): PushedPullRequest => ({
  id: 1,
  number: 42,
  nodeId: "pr-node-1",
  title: "Updated title",
  author: "octocat",
  repositoryOwner: "acme",
  repositoryName: "widget",
  htmlUrl: "https://github.com/acme/widget/pull/42",
  headSha: "bbb222",
  headRef: "feature/updated",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  state: "open",
  ...overrides,
});

describe("isSamePullRequest", () => {
  it("matches by id even when number/repo differ", () => {
    expect(isSamePullRequest(makePr({ number: 99, repositoryName: "other" }), makePushed({ id: 1 }))).toBe(true);
  });

  it("matches by number + repository when ids differ", () => {
    expect(isSamePullRequest(makePr({ id: 5 }), makePushed({ id: 7, number: 42 }))).toBe(true);
  });

  it("does not match the same number in a different repository", () => {
    expect(isSamePullRequest(makePr({ id: 5, repositoryName: "widget" }), makePushed({ id: 7, number: 42, repositoryName: "gadget" }))).toBe(false);
  });

  it("is case-insensitive on owner/repo", () => {
    expect(isSamePullRequest(makePr({ id: 5, repositoryOwner: "ACME", repositoryName: "Widget" }), makePushed({ id: 7, repositoryOwner: "acme", repositoryName: "widget" }))).toBe(true);
  });
});

describe("mergePullRequest", () => {
  it("updates metadata fields on the matching PR by id", () => {
    const prs = [makePr()];
    const pushed = makePushed();

    const result = mergePullRequest(prs, pushed);

    expect(result).not.toBe(prs);
    expect(result[0]).toMatchObject({
      title: "Updated title",
      headSha: "bbb222",
      headRef: "feature/updated",
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("keeps checkStatus, mergeable and labels untouched", () => {
    const prs = [makePr({ checkStatus: "Failure", mergeable: false, labels: [{ name: "urgent", color: "0000ff" }] })];
    const pushed = makePushed();

    const result = mergePullRequest(prs, pushed);

    expect(result[0].checkStatus).toBe("Failure");
    expect(result[0].mergeable).toBe(false);
    expect(result[0].labels).toEqual([{ name: "urgent", color: "0000ff" }]);
  });

  it("falls back to matching by number + repository when ids differ in type", () => {
    // Cached id is a string (as PullRequestModel allows), pushed id is numeric.
    const prs = [makePr({ id: "1", number: "42" })];
    const pushed = makePushed({ id: 1, number: 42 });

    const result = mergePullRequest(prs, pushed);

    expect(result[0].title).toBe("Updated title");
  });

  it("ignores a pushed PR that isn't already cached (no insert)", () => {
    const prs = [makePr()];
    const pushed = makePushed({ id: 999, number: 999 });

    const result = mergePullRequest(prs, pushed);

    expect(result).toBe(prs);
    expect(result).toHaveLength(1);
  });

  it("does not touch PRs from a different repository sharing the same number", () => {
    const prs = [makePr({ id: 1, number: 42, repositoryOwner: "acme", repositoryName: "widget" })];
    const pushed = makePushed({ id: 2, number: 42, repositoryOwner: "acme", repositoryName: "gizmo" });

    const result = mergePullRequest(prs, pushed);

    expect(result).toBe(prs);
  });

  it("leaves sibling PRs referentially unchanged", () => {
    const sibling = makePr({ id: 2, number: 7, title: "Sibling" });
    const prs = [makePr(), sibling];
    const pushed = makePushed();

    const result = mergePullRequest(prs, pushed);

    expect(result[1]).toBe(sibling);
  });
});

describe("removePullRequest", () => {
  it("removes the matching PR (merged/closed) from the list", () => {
    const sibling = makePr({ id: 2, number: 7, title: "Sibling" });
    const prs = [makePr(), sibling];
    const pushed = makePushed({ state: "closed" });

    const result = removePullRequest(prs, pushed);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(sibling);
  });

  it("matches by number + repository when ids differ in type", () => {
    const prs = [makePr({ id: "1", number: "42" })];
    const pushed = makePushed({ id: 1, number: 42, state: "closed" });

    const result = removePullRequest(prs, pushed);

    expect(result).toHaveLength(0);
  });

  it("returns the input unchanged when the PR isn't cached", () => {
    const prs = [makePr()];
    const pushed = makePushed({ id: 999, number: 999, state: "closed" });

    const result = removePullRequest(prs, pushed);

    expect(result).toBe(prs);
    expect(result).toHaveLength(1);
  });

  it("does not remove a PR from a different repository sharing the same number", () => {
    const prs = [makePr({ id: 1, number: 42, repositoryOwner: "acme", repositoryName: "widget" })];
    const pushed = makePushed({ id: 2, number: 42, repositoryOwner: "acme", repositoryName: "gizmo", state: "closed" });

    const result = removePullRequest(prs, pushed);

    expect(result).toBe(prs);
  });
});
