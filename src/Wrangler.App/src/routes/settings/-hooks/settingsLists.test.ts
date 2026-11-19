import { describe, it, expect } from "vitest";
import {
  matchesSearch,
  groupRepositories,
  defaultRepository,
  visibleWorkflows,
  selectedCount,
  setWorkflows,
} from "./settingsLists";
import type { SelectedRepository } from "./repositoryFeatures";

const repos = [
  { owner: "me", name: "zeta" },
  { owner: "me", name: "alpha" },
  { owner: "me", name: "platform" },
  { owner: "me", name: "web" },
];

const selected: SelectedRepository[] = [
  { owner: "me", name: "platform", workflows: [1] },
  { owner: "me", name: "web", pullRequests: true },
  { owner: "me", name: "alpha", workflows: [], pullRequests: false, securityAlerts: false },
];

const names = (list: { name: string }[]) => list.map((r) => r.name);

describe("matchesSearch", () => {
  it("matches case-insensitively on the trimmed search", () => {
    expect(matchesSearch("platform", "  PLAT ")).toBe(true);
  });

  it("rejects names without the substring", () => {
    expect(matchesSearch("docs", "plat")).toBe(false);
  });

  it("matches everything for a whitespace search", () => {
    expect(matchesSearch("docs", "   ")).toBe(true);
  });
});

describe("groupRepositories", () => {
  it("splits in-use and other repos, each sorted by name", () => {
    const { inUse, others } = groupRepositories(repos, selected, "");
    expect(names(inUse)).toEqual(["platform", "web"]);
    expect(names(others)).toEqual(["alpha", "zeta"]);
  });

  it("filters both groups by search", () => {
    const { inUse, others } = groupRepositories(repos, selected, "a");
    expect(names(inUse)).toEqual(["platform"]);
    expect(names(others)).toEqual(["alpha", "zeta"]);
  });

  it("matches selected entries on owner as well as name", () => {
    const { inUse, others } = groupRepositories([{ owner: "other", name: "platform" }], selected, "");
    expect(inUse).toEqual([]);
    expect(names(others)).toEqual(["platform"]);
  });

  it("sorts case-insensitively", () => {
    const { others } = groupRepositories([{ owner: "me", name: "b" }, { owner: "me", name: "A" }], [], "");
    expect(names(others)).toEqual(["A", "b"]);
  });
});

describe("defaultRepository", () => {
  it("prefers the first in-use repo", () => {
    expect(defaultRepository(repos, selected)?.name).toBe("platform");
  });

  it("falls back to the first other repo", () => {
    expect(defaultRepository(repos, [])?.name).toBe("alpha");
  });

  it("is undefined with no repos", () => {
    expect(defaultRepository([], selected)).toBeUndefined();
  });
});

describe("workflow helpers", () => {
  const workflows = [
    { id: 1, name: "api: build" },
    { id: 2, name: "web: build" },
    { id: 3, name: "api: deploy" },
  ];
  const ids = (list: { id?: number | string }[]) => list.map((w) => w.id);

  it("filters workflows by name", () => {
    expect(ids(visibleWorkflows(workflows, "API"))).toEqual([1, 3]);
  });

  it("counts only selected ids present in the workflow list", () => {
    expect(selectedCount(workflows, [3, 99])).toBe(1);
  });

  it("adds shown ids without duplicates and keeps stale ids", () => {
    expect(setWorkflows([3, 99], [{ id: 1 }, { id: 3 }], true)).toEqual([3, 99, 1]);
  });

  it("removes shown ids and keeps stale ids", () => {
    expect(setWorkflows([1, 3, 99], [{ id: 1 }, { id: 3 }], false)).toEqual([99]);
  });

  it("compares ids strictly", () => {
    expect(setWorkflows(["1"], [{ id: 1 }], false)).toEqual(["1"]);
  });
});
