import { describe, it, expect } from "vitest";
import { filterByStatus } from "./useWorkflows";
import type { RepositoryModel } from "../../../api";

const repo = (name: string, statuses: (RepositoryModel["overallStatus"])[]): RepositoryModel => ({
  name,
  owner: "acme",
  nodeId: `node-${name}`,
  htmlUrl: `https://github.com/acme/${name}`,
  overallStatus: statuses[0],
  workflows: statuses.map((s, i) => ({
    id: i,
    nodeId: `wf-${name}-${i}`,
    name: `wf-${i}`,
    htmlUrl: "",
    overallStatus: s,
    runs: [],
  })),
});

describe("filterByStatus", () => {
  const repos: RepositoryModel[] = [
    repo("alpha", ["Green", "Red"]),
    repo("beta", ["Green"]),
  ];

  it("returns the input unchanged when no statuses are selected", () => {
    expect(filterByStatus(repos, [])).toBe(repos);
  });

  it("keeps only workflows whose overall status is selected", () => {
    const result = filterByStatus(repos, ["Red"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("alpha");
    expect(result[0].workflows?.map((w) => w.overallStatus)).toEqual(["Red"]);
  });

  it("keeps a repo when any of its workflows match, across multiple statuses", () => {
    const result = filterByStatus(repos, ["Green"]);
    expect(result.map((r) => r.name)).toEqual(["alpha", "beta"]);
    expect(result[0].workflows).toHaveLength(1);
    expect(result[1].workflows).toHaveLength(1);
  });

  it("drops repositories left with no matching workflows", () => {
    const result = filterByStatus(repos, ["Amber"]);
    expect(result).toEqual([]);
  });

  it("ignores workflows with no overall status", () => {
    const withNone = [repo("gamma", ["None", "Green"])];
    const result = filterByStatus(withNone, ["Green"]);
    expect(result[0].workflows).toHaveLength(1);
    expect(result[0].workflows?.[0].overallStatus).toBe("Green");
  });
});
