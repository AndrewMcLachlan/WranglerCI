import { describe, it, expect } from "vitest";
import {
  hasDashboardWorkflows,
  migrateRepositories,
  ensureMigrated,
  upsertRepository,
  REPOSITORIES_KEY,
  PR_REPOSITORIES_KEY,
  SCHEMA_VERSION_KEY,
  SCHEMA_VERSION,
  type SelectedRepository,
  type StorageLike,
} from "./repositoryFeatures";

const makeStorage = (initial: Record<string, string> = {}): StorageLike & { dump: () => Record<string, string> } => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    dump: () => Object.fromEntries(store),
  };
};

describe("hasDashboardWorkflows", () => {
  it("is true when workflows are selected", () => {
    expect(hasDashboardWorkflows({ owner: "a", name: "r", workflows: [1] })).toBe(true);
  });

  it("is false for empty or absent workflows", () => {
    expect(hasDashboardWorkflows({ owner: "a", name: "r", workflows: [] })).toBe(false);
    expect(hasDashboardWorkflows({ owner: "a", name: "r" })).toBe(false);
  });
});

describe("migrateRepositories", () => {
  const stored = (repos: SelectedRepository[]) => JSON.stringify(repos);

  it("seeds securityAlerts on every existing entry, including workflow-less ones", () => {
    const result = migrateRepositories(
      stored([
        { owner: "a", name: "one", workflows: [1, 2] },
        { owner: "a", name: "cleared", workflows: [] },
      ]),
      JSON.stringify([]),
    );
    expect(result.every((r) => r.securityAlerts === true)).toBe(true);
  });

  it("seeds pullRequests on all entries when prRepositories key is absent (old seeding behavior)", () => {
    const result = migrateRepositories(stored([{ owner: "a", name: "one", workflows: [1] }]), null);
    expect(result).toEqual([{ owner: "a", name: "one", workflows: [1], securityAlerts: true, pullRequests: true }]);
  });

  it("flags matching entries and appends PR-only entries when prRepositories key exists", () => {
    const result = migrateRepositories(
      stored([
        { owner: "a", name: "both", workflows: [1] },
        { owner: "a", name: "dash-only", workflows: [2] },
      ]),
      JSON.stringify([
        { owner: "a", name: "both" },
        { owner: "b", name: "pr-only" },
      ]),
    );
    expect(result).toEqual([
      { owner: "a", name: "both", workflows: [1], securityAlerts: true, pullRequests: true },
      { owner: "a", name: "dash-only", workflows: [2], securityAlerts: true },
      { owner: "b", name: "pr-only", workflows: [], pullRequests: true, securityAlerts: false },
    ]);
  });

  it("does not seed pullRequests when prRepositories exists but is empty (intentionally-emptied scope)", () => {
    const result = migrateRepositories(stored([{ owner: "a", name: "one", workflows: [1] }]), JSON.stringify([]));
    expect(result[0].pullRequests).toBeUndefined();
  });

  it("treats corrupt or non-array JSON as empty", () => {
    expect(migrateRepositories("not json", null)).toEqual([]);
    expect(migrateRepositories('{"a":1}', null)).toEqual([]);
    expect(migrateRepositories(null, "not json")).toEqual([]);
  });
});

describe("ensureMigrated", () => {
  it("migrates, stamps the version, and deletes the prRepositories key", () => {
    const storage = makeStorage({
      [REPOSITORIES_KEY]: JSON.stringify([{ owner: "a", name: "one", workflows: [1] }]),
      [PR_REPOSITORIES_KEY]: JSON.stringify([{ owner: "a", name: "one" }]),
    });
    ensureMigrated(storage);
    const dump = storage.dump();
    expect(dump[SCHEMA_VERSION_KEY]).toBe(SCHEMA_VERSION);
    expect(dump[PR_REPOSITORIES_KEY]).toBeUndefined();
    expect(JSON.parse(dump[REPOSITORIES_KEY])).toEqual([
      { owner: "a", name: "one", workflows: [1], securityAlerts: true, pullRequests: true },
    ]);
  });

  it("is a no-op when the version stamp is current", () => {
    const untouched = JSON.stringify([{ owner: "a", name: "one", workflows: [1] }]);
    const storage = makeStorage({
      [REPOSITORIES_KEY]: untouched,
      [SCHEMA_VERSION_KEY]: SCHEMA_VERSION,
    });
    ensureMigrated(storage);
    expect(storage.dump()[REPOSITORIES_KEY]).toBe(untouched);
  });

  it("handles a completely empty storage (new user)", () => {
    const storage = makeStorage();
    ensureMigrated(storage);
    expect(JSON.parse(storage.dump()[REPOSITORIES_KEY])).toEqual([]);
    expect(storage.dump()[SCHEMA_VERSION_KEY]).toBe(SCHEMA_VERSION);
  });
});

describe("upsertRepository", () => {
  it("patches an existing entry without mutating the input array or entry", () => {
    const original: SelectedRepository[] = [{ owner: "a", name: "one", workflows: [1] }];
    const entryBefore = original[0];
    const result = upsertRepository(original, "a", "one", { pullRequests: true });
    expect(result).toEqual([{ owner: "a", name: "one", workflows: [1], pullRequests: true }]);
    expect(original).toEqual([{ owner: "a", name: "one", workflows: [1] }]);
    expect(entryBefore).toEqual({ owner: "a", name: "one", workflows: [1] });
    expect(result[0]).not.toBe(entryBefore);
  });

  it("creates a new entry with empty workflows when none exists", () => {
    const result = upsertRepository([], "a", "new", { securityAlerts: true });
    expect(result).toEqual([{ owner: "a", name: "new", workflows: [], securityAlerts: true }]);
  });

  it("leaves other entries untouched", () => {
    const result = upsertRepository(
      [
        { owner: "a", name: "one", workflows: [1] },
        { owner: "a", name: "two", workflows: [2] },
      ],
      "a",
      "two",
      { workflows: [2, 3] },
    );
    expect(result).toContainEqual({ owner: "a", name: "one", workflows: [1] });
    expect(result).toContainEqual({ owner: "a", name: "two", workflows: [2, 3] });
  });
});
