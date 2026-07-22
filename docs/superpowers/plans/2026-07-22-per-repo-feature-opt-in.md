# Per-Repo Feature Opt-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all per-repo feature membership (Dashboard/Gates workflows, Pull Requests, Security Alerts) into the single `repositories` localStorage key, configured entirely from the Settings page, retiring the PR page's in-page repo picker.

**Architecture:** Frontend-only change in `src/Wrangler.App`. A new pure module `repositoryFeatures.ts` owns the extended data model logic: one-time migration, membership predicates, and the fresh-entry upsert helper. Hooks and components consume it. A minimal Vitest setup is added so the pure logic is unit-tested; components are verified by build + manual QA (no component-test infra exists and none is added).

**Tech Stack:** React 19, TanStack Router (file-based), TanStack Query 5, Vitest (new devDependency), CSS with `@scope`.

**Spec:** `docs/superpowers/specs/2026-07-22-per-repo-feature-opt-in-design.md`

## Global Constraints

- Frontend only — no changes under `src/Wrangler.Api/`, no API/OpenAPI changes, no regeneration of `src/Wrangler.App/src/api/` (never edit that directory).
- All selection state stays in **localStorage** — no backend store.
- All npm commands run from `src/Wrangler.App`.
- Membership predicates (absent flags read as `false`):
  - Dashboard / Gates: `(workflows?.length ?? 0) > 0`
  - Pull Requests: `pullRequests === true`
  - Security alerts: `securityAlerts === true`
- Migration guard key: `repositoriesSchemaVersion`, version value `"2"`. Migration deletes the `prRepositories` key.
- Never mutate objects that may live in the react-query cache — always build fresh entries (the PR #200 cache-corruption fix). `upsertRepository` exists to enforce this.
- Verification gate for every task: `npm test`, `npm run lint`, and `npm run build` all pass.
- Work on branch `feature/per-repo-feature-opt-in` (created in Task 1).

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/routes/settings/-hooks/repositoryFeatures.ts` | Create | Pure model logic: `SelectedRepository` type, storage keys, migration, predicates, upsert helper, attention-item visibility. No React, no side effects except `ensureMigrated(storage)` writing to the storage it is handed. |
| `src/routes/settings/-hooks/repositoryFeatures.test.ts` | Create | Vitest unit tests for everything in `repositoryFeatures.ts`. |
| `src/routes/settings/-hooks/useSelectedRepositories.ts` | Modify | Re-exports the type; runs `ensureMigrated(localStorage)` before reading. |
| `src/routes/settings/-components/RepoFeatures.tsx` | Create | Settings right-hand panel: Features switches + Dashboard Workflows checklist (replaces `WorkflowSelector.tsx`). |
| `src/routes/settings/-components/WorkflowSelector.tsx` | Delete | Superseded by `RepoFeatures.tsx`. |
| `src/routes/settings/-components/RepoSelector.tsx` | Modify | All repos selectable; feature-indicator icons in the left nav. |
| `src/css/components/settings/repo-features.css` | Create | Styles for the new panel (replaces `workflow-selector.css`). |
| `src/css/components/settings/workflow-selector.css` | Delete | Superseded. |
| `src/css/components/settings.css` | Modify | Import swap. |
| `src/css/components/settings/repo-selector.css` | Modify | Drop the `.disabled` mute rule; style the icon row. |
| `src/main.tsx` | Modify | Register three new FontAwesome icons. |
| `src/components/NoRepositories.tsx` | Modify | Accept optional `title`/`message` props. |
| `src/routes/pull-requests/-hooks/usePullRequests.ts` | Modify | Derive repo scope from the unified model. |
| `src/routes/pull-requests/-hooks/usePrRepositories.ts` | Delete | Retired (`prRepositories` key migrated away). |
| `src/routes/pull-requests/-components/PullRequests.tsx` | Modify | Remove repo ComboBox; empty-state guard. |
| `src/routes/dashboard.tsx` | Modify | `hasRepos` uses the dashboard predicate. |
| `src/routes/dashboard/-hooks/useWorkflows.ts` | Modify | Use shared predicate (behavior unchanged). |
| `src/routes/gates/-hooks/useGates.ts` | Modify | Filter to dashboard predicate. |
| `src/routes/gates/-components/Gates.tsx` | Modify | Guard uses dashboard predicate. |
| `src/routes/attention/-hooks/useAttention.ts` | Modify | Send union of opted-in repos. |
| `src/routes/attention/-components/Attention.tsx` | Modify | Per-type client-side filtering; union-based guard. |
| `package.json` / `vitest.config.ts` | Modify / Create | Vitest devDependency, `test` script, config. |

Files under a `-`-prefixed folder in `src/routes/` are ignored by TanStack Router's file-based routing, so the new `-hooks` files (including the test) create no routes.

---

### Task 1: Vitest setup + pure model module with migration logic

**Files:**
- Modify: `src/Wrangler.App/package.json` (devDependency + script)
- Create: `src/Wrangler.App/vitest.config.ts`
- Create: `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.ts`
- Modify: `src/Wrangler.App/src/routes/settings/-hooks/useSelectedRepositories.ts`
- Test: `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces (later tasks rely on these exact names):
  - `interface SelectedRepository { owner: string; name: string; workflows?: (number | string)[]; pullRequests?: boolean; securityAlerts?: boolean }` — defined in `repositoryFeatures.ts`, re-exported from `useSelectedRepositories.ts`.
  - `hasDashboardWorkflows(repo: SelectedRepository): boolean`
  - `migrateRepositories(repositoriesJson: string | null, prRepositoriesJson: string | null): SelectedRepository[]`
  - `ensureMigrated(storage: StorageLike): void` and `type StorageLike`
  - `upsertRepository(repositories: SelectedRepository[], owner: string, name: string, patch: Partial<Omit<SelectedRepository, "owner" | "name">>): SelectedRepository[]`
  - Constants: `REPOSITORIES_KEY = "repositories"`, `PR_REPOSITORIES_KEY = "prRepositories"`, `SCHEMA_VERSION_KEY = "repositoriesSchemaVersion"`, `SCHEMA_VERSION = "2"`.
  - `useSelectedRepositories()` / `useUpdateSelectedRepositories()` — unchanged signatures, but reads are now migration-guarded.

- [ ] **Step 1: Create the working branch**

```bash
cd src/Wrangler.App
git checkout -b feature/per-repo-feature-opt-in
```

- [ ] **Step 2: Install Vitest and add the test script**

```bash
npm install -D vitest
```

Then in `package.json`, add to `"scripts"` (after `"generate"`):

```json
    "test": "vitest run",
```

Note: this repo installs cleanly with no npm flags (do not add `--force` or `--legacy-peer-deps`).

- [ ] **Step 3: Create `vitest.config.ts`**

Create `src/Wrangler.App/vitest.config.ts`. A standalone vitest config is used deliberately so Vitest does NOT load `vite.config.ts` (which pulls in the TanStack Router plugin and svgr — unnecessary and fragile for node-environment unit tests):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write the failing tests**

Create `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.test.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./repositoryFeatures` (module does not exist yet).

- [ ] **Step 6: Implement `repositoryFeatures.ts`**

Create `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.ts`:

```ts
/**
 * Pure logic for the unified per-repo feature model stored in the
 * "repositories" localStorage key. No React and no direct localStorage access
 * (ensureMigrated writes only to the storage it is handed) so everything here
 * is unit-testable in a node environment.
 */

export interface SelectedRepository {
  owner: string;
  name: string;
  workflows?: (number | string)[]; // dashboard + gates
  pullRequests?: boolean;          // repo appears on the Pull Requests page
  securityAlerts?: boolean;        // security alerts shown in the Attention feed
}

export const REPOSITORIES_KEY = "repositories";
export const PR_REPOSITORIES_KEY = "prRepositories";
export const SCHEMA_VERSION_KEY = "repositoriesSchemaVersion";
export const SCHEMA_VERSION = "2";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A repo is on the Dashboard (and therefore Gates) iff it has selected workflows. */
export const hasDashboardWorkflows = (repo: SelectedRepository): boolean =>
  (repo.workflows?.length ?? 0) > 0;

const repoKey = (owner: string, name: string) => `${owner}/${name}`;

const parseArray = <T>(json: string | null): T[] => {
  if (json === null) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};

/**
 * One-time v2 migration (pure core). Every existing entry gets
 * securityAlerts: true — the old Attention feed sent every entry, so this
 * preserves behavior exactly. The old PR scope seeds pullRequests: a null
 * prRepositoriesJson means the key was absent, where the old PR page fell back
 * to the whole "repositories" list; an existing (possibly empty) key was an
 * explicit, independent scope.
 */
export const migrateRepositories = (
  repositoriesJson: string | null,
  prRepositoriesJson: string | null,
): SelectedRepository[] => {
  const repositories = parseArray<SelectedRepository>(repositoriesJson);
  const migrated = repositories.map((r) => ({ ...r, securityAlerts: true }));

  if (prRepositoriesJson === null) {
    return migrated.map((r) => ({ ...r, pullRequests: true }));
  }

  const prScope = parseArray<{ owner: string; name: string }>(prRepositoriesJson);
  const prKeys = new Set(prScope.map((r) => repoKey(r.owner, r.name)));
  const existingKeys = new Set(migrated.map((r) => repoKey(r.owner, r.name)));

  const flagged = migrated.map((r) =>
    prKeys.has(repoKey(r.owner, r.name)) ? { ...r, pullRequests: true } : r);

  // Repos that were PR-scoped but never selected in settings become PR-only entries.
  const added = prScope
    .filter((r) => !existingKeys.has(repoKey(r.owner, r.name)))
    .map((r): SelectedRepository => ({
      owner: r.owner,
      name: r.name,
      workflows: [],
      pullRequests: true,
      securityAlerts: false,
    }));

  return [...flagged, ...added];
};

/** Runs the migration at most once, guarded by the schema version stamp. */
export const ensureMigrated = (storage: StorageLike): void => {
  if (storage.getItem(SCHEMA_VERSION_KEY) === SCHEMA_VERSION) return;
  const migrated = migrateRepositories(
    storage.getItem(REPOSITORIES_KEY),
    storage.getItem(PR_REPOSITORIES_KEY),
  );
  storage.setItem(REPOSITORIES_KEY, JSON.stringify(migrated));
  storage.setItem(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
  storage.removeItem(PR_REPOSITORIES_KEY);
};

/**
 * Returns a new list with the (owner, name) entry patched, creating it with
 * empty workflows if absent. Always builds fresh objects — entries may be
 * references into the react-query cache, and mutating them in place corrupts
 * the cache and defeats referential-equality change detection.
 */
export const upsertRepository = (
  repositories: SelectedRepository[],
  owner: string,
  name: string,
  patch: Partial<Omit<SelectedRepository, "owner" | "name">>,
): SelectedRepository[] => {
  const existing = repositories.find((r) => r.owner === owner && r.name === name)
    ?? { owner, name, workflows: [] };
  const rest = repositories.filter((r) => !(r.owner === owner && r.name === name));
  return [...rest, { ...existing, ...patch }];
};
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests green).

- [ ] **Step 8: Wire the model into `useSelectedRepositories.ts`**

Replace the full contents of `src/Wrangler.App/src/routes/settings/-hooks/useSelectedRepositories.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureMigrated, REPOSITORIES_KEY, type SelectedRepository } from "./repositoryFeatures";

export type { SelectedRepository } from "./repositoryFeatures";

export const useSelectedRepositories = () => {

  ensureMigrated(localStorage);
  const data = JSON.parse(localStorage.getItem(REPOSITORIES_KEY) ?? "[]") as SelectedRepository[];

  return useQuery({
    queryKey: ["selectedRepositories", data],
    queryFn: () => {
      return data;
    },
    initialData: [],
  })
}

export const useUpdateSelectedRepositories = () => {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repositories: SelectedRepository[]) => {
      localStorage.setItem(REPOSITORIES_KEY, JSON.stringify(repositories));
    },
    onSettled: () => {
      queryClient.refetchQueries({
        queryKey: ["selectedRepositories"],
        exact: true,
      });
    },
  });
}
```

Existing importers (`WorkflowSelector.tsx` and later files) keep importing `SelectedRepository` from `useSelectedRepositories` — the re-export preserves that.

- [ ] **Step 9: Verify build and lint**

Run: `npm test && npm run lint && npm run build`
Expected: all pass, no new lint errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/routes/settings/-hooks/repositoryFeatures.ts src/routes/settings/-hooks/repositoryFeatures.test.ts src/routes/settings/-hooks/useSelectedRepositories.ts
git commit -m "Add unified per-repo feature model with one-time migration

Extends SelectedRepository with pullRequests/securityAlerts flags, adds the
v2 localStorage migration (guarded by repositoriesSchemaVersion), and sets up
Vitest for the pure model logic."
```

---

### Task 2: Settings panel — RepoFeatures (replaces WorkflowSelector)

**Files:**
- Create: `src/Wrangler.App/src/routes/settings/-components/RepoFeatures.tsx`
- Delete: `src/Wrangler.App/src/routes/settings/-components/WorkflowSelector.tsx`
- Modify: `src/Wrangler.App/src/routes/settings/-components/RepoSelector.tsx` (import swap only in this task)
- Create: `src/Wrangler.App/src/css/components/settings/repo-features.css`
- Delete: `src/Wrangler.App/src/css/components/settings/workflow-selector.css`
- Modify: `src/Wrangler.App/src/css/components/settings.css`

**Interfaces:**
- Consumes: `useSelectedRepositories()`, `useUpdateSelectedRepositories()`, `upsertRepository(...)`, `SelectedRepository` (Task 1); `SettingsRepositoryModel`, `WorkflowBase` from `../../../api`.
- Produces: `RepoFeatures: React.FC<RepoFeaturesProps>` with `RepoFeaturesProps { repository: SettingsRepositoryModel }` — consumed by `RepoSelector` (Task 3 restyles it; this task only swaps the import).

- [ ] **Step 1: Create `RepoFeatures.tsx`**

Create `src/Wrangler.App/src/routes/settings/-components/RepoFeatures.tsx`. This is `WorkflowSelector` renamed, with the Features section added and the generic `commit(patch)` built on `upsertRepository`:

```tsx
import { useSelectedRepositories, useUpdateSelectedRepositories, type SelectedRepository } from "../-hooks/useSelectedRepositories";
import { upsertRepository } from "../-hooks/repositoryFeatures";
import type { SettingsRepositoryModel, WorkflowBase } from "../../../api";
import { useMemo } from "react";

export const RepoFeatures: React.FC<React.PropsWithChildren<RepoFeaturesProps>> = ({ repository }) => {

  const { data: repositories } = useSelectedRepositories();

  const repositoryEntry = useMemo(() =>
    repositories?.find(r => r.owner === repository.owner && r.name === repository.name) ?? { owner: repository.owner, name: repository.name, workflows: [] } as SelectedRepository,
    [repositories, repository]);

  const { mutate } = useUpdateSelectedRepositories();

  // upsertRepository builds fresh entries rather than mutating repositoryEntry
  // in place: it may be a reference into the react-query cache, and mutating it
  // corrupts that cache and defeats referential-equality change detection.
  const commit = (patch: Partial<Omit<SelectedRepository, "owner" | "name">>) => {
    mutate(upsertRepository(repositories, repositoryEntry.owner, repositoryEntry.name, patch));
  };

  const workflows = repositoryEntry.workflows ?? [];

  const handleWorkflowsChange = (workflow: WorkflowBase) => {
    commit({
      workflows: workflows.some(wf => wf === workflow.id!) ?
        workflows.filter(wf => wf !== workflow.id!) :
        [...workflows, workflow.id!],
    });
  }

  const selectAll = () => {
    commit({ workflows: repository.workflows?.map(wf => wf.id!) ?? [] });
  };

  const clear = () => {
    commit({ workflows: [] });
  };

  const hasWorkflows = (repository.workflows?.length ?? 0) > 0;

  return (
    <div className="repo-features">
      <h3>Features</h3>
      <ul className="feature-switches">
        <li className="form-check form-switch">
          <input id="feature-pull-requests" type="checkbox" className="form-check-input" checked={repositoryEntry.pullRequests === true} onChange={() => commit({ pullRequests: repositoryEntry.pullRequests !== true })} />
          <label htmlFor="feature-pull-requests" className="form-check-label">Pull Requests</label>
        </li>
        <li className="form-check form-switch">
          <input id="feature-security-alerts" type="checkbox" className="form-check-input" checked={repositoryEntry.securityAlerts === true} onChange={() => commit({ securityAlerts: repositoryEntry.securityAlerts !== true })} />
          <label htmlFor="feature-security-alerts" className="form-check-label">Security Alerts</label>
        </li>
      </ul>
      <h3>Dashboard Workflows</h3>
      {hasWorkflows ? (
        <>
          <div><button className="btn btn-link" onClick={selectAll}>Select All</button> <button className="btn btn-link" onClick={clear}>Clear</button></div>
          <ul>
            {repository.workflows?.map(workflow => (
              <li key={workflow.id} className="form-check form-switch">
                <input id={workflow.id?.toString()} type="checkbox" className="form-check-input" checked={workflows.some(wf => wf === workflow.id)} onChange={() => handleWorkflowsChange(workflow)} />
                <label htmlFor={workflow.id?.toString()} className="form-check-label">{workflow.name}</label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="no-workflows">No GitHub Actions workflows in this repository.</p>
      )}
    </div>
  );
}

export interface RepoFeaturesProps {
  repository: SettingsRepositoryModel;
}
```

- [ ] **Step 2: Point `RepoSelector` at the new component and delete the old one**

In `src/Wrangler.App/src/routes/settings/-components/RepoSelector.tsx`, replace:

```tsx
import { WorkflowSelector } from "./WorkflowSelector";
```

with:

```tsx
import { RepoFeatures } from "./RepoFeatures";
```

and replace:

```tsx
          <WorkflowSelector repository={selectedRepo} />
```

with:

```tsx
          <RepoFeatures repository={selectedRepo} />
```

Then delete the old file:

```bash
git rm src/routes/settings/-components/WorkflowSelector.tsx
```

- [ ] **Step 3: Swap the stylesheet**

Create `src/Wrangler.App/src/css/components/settings/repo-features.css`:

```css
@scope(.repo-features) {

    .btn-link {
        padding: 0;
    }

    h3 {
        margin-bottom: 0.5rem;
    }

    ul {
        margin: 0;
        margin-top: 1rem;
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    ul.feature-switches {
        margin-top: 0;
        margin-bottom: 1.5rem;
    }

    .no-workflows {
        opacity: 0.6;
    }
}
```

In `src/Wrangler.App/src/css/components/settings.css`, replace:

```css
@import "./settings/workflow-selector.css";
```

with:

```css
@import "./settings/repo-features.css";
```

Then delete the old stylesheet:

```bash
git rm src/css/components/settings/workflow-selector.css
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. (`WorkflowSelector` had no other importers — `RepoSelector.tsx` was the only one.)

- [ ] **Step 5: Manual check**

Run: `npm run dev`, open the app, go to Settings.
Expected: each selectable repo shows a **Features** section (Pull Requests / Security Alerts switches) above **Dashboard Workflows**; toggling a switch persists across a page reload (check the `repositories` key in devtools → Application → Local Storage). Repos with no workflows are still disabled in the nav — that changes in Task 3.

- [ ] **Step 6: Commit**

```bash
git add -A src/routes/settings/-components src/css/components/settings.css src/css/components/settings
git commit -m "Add per-repo feature switches to settings panel

Replaces WorkflowSelector with RepoFeatures: Pull Requests and Security
Alerts switches above the existing Dashboard Workflows checklist."
```

---

### Task 3: RepoSelector — every repo selectable, with feature-indicator icons

**Files:**
- Modify: `src/Wrangler.App/src/routes/settings/-components/RepoSelector.tsx`
- Modify: `src/Wrangler.App/src/main.tsx`
- Modify: `src/Wrangler.App/src/css/components/settings/repo-selector.css`

**Interfaces:**
- Consumes: `RepoFeatures` (Task 2), `useSelectedRepositories()`, `hasDashboardWorkflows` (Task 1).
- Produces: no new exports — `RepoSelector` keeps its existing `RepoSelectorProps { account: AccountModel }`.

- [ ] **Step 1: Register the three indicator icons**

In `src/Wrangler.App/src/main.tsx`, extend the existing FontAwesome import (line 10) to add `faCodePullRequest`, `faGauge`, `faShieldHalved`:

```ts
import { faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCodePullRequest, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
```

and extend the `library.add` call (line 19) to match:

```ts
library.add(faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faCodePullRequest, faGauge, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle);
```

- [ ] **Step 2: Rewrite `RepoSelector.tsx`**

Replace the full contents of `src/Wrangler.App/src/routes/settings/-components/RepoSelector.tsx` with:

```tsx
import { Nav } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { AccountModel, SettingsRepositoryModel } from "../../../api";
import { useState } from "react";
import { RepoFeatures } from "./RepoFeatures";
import { useSelectedRepositories } from "../-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../-hooks/repositoryFeatures";

export const RepoSelector: React.FC<React.PropsWithChildren<RepoSelectorProps>> = ({ account }) => {

  // Every repo is selectable — a repo without workflows can still be opted
  // into Pull Requests or Security Alerts.
  const [selectedRepo, setSelectedRepo] = useState<SettingsRepositoryModel | undefined>(account.repositories?.[0]);
  const { data: selectedRepositories } = useSelectedRepositories();

  return (
    <>
      <div className="sidebar">
        <Nav>
          {account.repositories?.map(repo => {
            const entry = selectedRepositories.find(r => r.owner === repo.owner && r.name === repo.name);
            return (
              <Nav.Link
                key={repo.name}
                active={selectedRepo?.name === repo.name}
                onClick={() => setSelectedRepo(repo)}
              >
                <span className="repo-name">{repo.name}</span>
                <span className="repo-feature-icons">
                  {entry && hasDashboardWorkflows(entry) && <FontAwesomeIcon icon="gauge" title="On dashboard" />}
                  {entry?.pullRequests === true && <FontAwesomeIcon icon="code-pull-request" title="Pull requests" />}
                  {entry?.securityAlerts === true && <FontAwesomeIcon icon="shield-halved" title="Security alerts" />}
                </span>
              </Nav.Link>
            );
          })}
        </Nav>
      </div>
      <div className="section-content">
        {selectedRepo && (
          <RepoFeatures repository={selectedRepo} />
        )}
      </div>
    </>
  );
}

export interface RepoSelectorProps {
  account: AccountModel;
}
```

- [ ] **Step 3: Update the nav styles**

Replace the full contents of `src/Wrangler.App/src/css/components/settings/repo-selector.css` with (the `.disabled` mute rule goes away — nothing is disabled any more — and the link becomes a name + icon row):

```css
.repo-selector {
    display: flex;

    .sidebar {
        flex: 200px 0 1;
        width: auto;
        min-width: auto;
        overflow: visible;

        .nav {
            flex: 200px 0 1;
            flex-direction: column;
            flex-wrap: nowrap;
            min-width: auto;
            width: auto;

            .nav-link {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
            }

            .repo-feature-icons {
                display: inline-flex;
                gap: 0.35rem;
                font-size: 0.75em;
                opacity: 0.7;
            }
        }
    }
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, go to Settings.
Expected: repos without workflows are now clickable; selecting one shows the Features switches and the muted "No GitHub Actions workflows in this repository." note. Toggling features updates the little icons in the left nav immediately.

- [ ] **Step 6: Commit**

```bash
git add src/routes/settings/-components/RepoSelector.tsx src/main.tsx src/css/components/settings/repo-selector.css
git commit -m "Make every repo selectable in settings with feature indicator icons"
```

---

### Task 4: Pull Requests — scope from the unified model, repo picker removed

**Files:**
- Modify: `src/Wrangler.App/src/routes/pull-requests/-hooks/usePullRequests.ts`
- Delete: `src/Wrangler.App/src/routes/pull-requests/-hooks/usePrRepositories.ts`
- Modify: `src/Wrangler.App/src/routes/pull-requests/-components/PullRequests.tsx`
- Modify: `src/Wrangler.App/src/components/NoRepositories.tsx`

**Interfaces:**
- Consumes: `useSelectedRepositories()` (Task 1); `SelectedRepository.pullRequests`.
- Produces: `NoRepositories` gains optional props `NoRepositoriesProps { title?: string; message?: ReactNode }` (defaults preserve current copy — existing callers in `dashboard.tsx`, `Gates.tsx`, `Attention.tsx` are unaffected). `usePullRequests()` keeps its signature.

- [ ] **Step 1: Extend `NoRepositories` with optional copy props**

Replace the full contents of `src/Wrangler.App/src/components/NoRepositories.tsx` with:

```tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const NoRepositories: React.FC<NoRepositoriesProps> = ({ title = "No repositories selected", message }) => (
  <div className="no-repositories">
    <svg className="no-repositories-image" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="30" width="140" height="100" rx="8" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" opacity="0.3" />
      <rect x="50" y="50" width="100" height="14" rx="4" fill="currentColor" opacity="0.12" />
      <rect x="50" y="72" width="80" height="14" rx="4" fill="currentColor" opacity="0.08" />
      <rect x="50" y="94" width="60" height="14" rx="4" fill="currentColor" opacity="0.05" />
      <circle cx="155" cy="115" r="30" fill="currentColor" opacity="0.08" />
      <path d="M145 115 L155 105 L165 115 M155 105 V128" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
    </svg>
    <h3>{title}</h3>
    <p>{message ?? <>Head over to <Link to="/settings">Settings</Link> to choose which repositories and workflows to monitor.</>}</p>
  </div>
);

export interface NoRepositoriesProps {
  title?: string;
  message?: ReactNode;
}
```

- [ ] **Step 2: Rewrite `usePullRequests.ts`**

Replace the full contents of `src/Wrangler.App/src/routes/pull-requests/-hooks/usePullRequests.ts` with:

```ts
import { useQuery } from "@tanstack/react-query";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { usePrAuthors } from "./usePrAuthors";
import { postPullRequests } from "../../../api";

export const usePullRequests = () => {

  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: authors } = usePrAuthors();

  const repositories = selectedRepositories
    .filter(r => r.pullRequests === true)
    .map(r => ({ owner: r.owner, name: r.name }));

  return useQuery({
    queryKey: ["pullRequests", repositories, authors],
    queryFn: async () => {
      const result = await postPullRequests({
        body: {
          repositories,
          authors,
        },
      });
      return result.data;
    },
    enabled: repositories.length > 0 && authors.length > 0,
    // SSE drives freshness; polling is a safety net for missed events.
    refetchInterval: 10 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Delete the retired hook**

```bash
git rm src/routes/pull-requests/-hooks/usePrRepositories.ts
```

- [ ] **Step 4: Remove the repo picker from `PullRequests.tsx`**

In `src/Wrangler.App/src/routes/pull-requests/-components/PullRequests.tsx`, make these edits:

4a. Replace the imports

```tsx
import { usePrRepositories, useUpdatePrRepositories } from "../-hooks/usePrRepositories";
```
and
```tsx
import { useRepositories } from "../../../hooks/useRepositories";
```

with:

```tsx
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { NoRepositories } from "../../../components/NoRepositories";
```

and add `Link` to the router import at the top of the file (there is currently no `@tanstack/react-router` import — add one):

```tsx
import { Link } from "@tanstack/react-router";
```

4b. Delete the `RepoOption` interface and the `repoKey` helper (the block near the top of the file):

```tsx
interface RepoOption {
  owner: string;
  name: string;
  id: string;
  label: string;
}

const repoKey = (owner: string, name: string) => `${owner}/${name}`;
```

4c. In the component body, replace:

```tsx
  const { data: prRepositories } = usePrRepositories();
  const { mutate: updatePrRepositories } = useUpdatePrRepositories();
  const { data: availableRepositories } = useRepositories();
```

with:

```tsx
  const { data: selectedRepositories } = useSelectedRepositories();
  const prRepositories = useMemo(
    () => selectedRepositories.filter((r) => r.pullRequests === true),
    [selectedRepositories]);
```

4d. Delete both `useMemo` blocks that built the picker options — the one assigning `repoOptions` (comment "Every repository the user can access, as options for the PR scope picker.") and the one assigning `selectedRepoOptions` (comment "The currently-scoped repos as picker options; ...").

4e. In the JSX, delete the whole repo-picker block from the control bar:

```tsx
        <div className="pr-repositories">
          <span className="pr-repositories-label">Repositories</span>
          <ComboBox<RepoOption>
            className="repository-scope"
            placeholder="Add repositories..."
            multiSelect
            items={repoOptions}
            selectedItems={selectedRepoOptions}
            labelField={(r) => r.label}
            valueField={(r) => r.id}
            onChange={(items) => updatePrRepositories(items.map((r) => ({ owner: r.owner, name: r.name })))}
          />
        </div>
```

4f. Add the empty-state guard immediately before the component's `return (` statement (after all hooks, so hook order is stable):

```tsx
  if (prRepositories.length === 0) {
    return (
      <NoRepositories
        title="No repositories opted into Pull Requests"
        message={<>Head over to <Link to="/settings">Settings</Link> and switch on <strong>Pull Requests</strong> for the repositories you want to see here.</>}
      />
    );
  }
```

4g. Simplify the grid's empty message — replace:

```tsx
        emptyMessage={prRepositories.length === 0 ? "Select repositories to see pull requests." : "No open pull requests found."}
```

with:

```tsx
        emptyMessage="No open pull requests found."
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. Lint confirms no unused imports remain (`ComboBox` is still used by the tag filters — do not remove it).

- [ ] **Step 6: Manual check**

Run: `npm run dev`.
Expected: the PR page no longer shows the "Repositories" ComboBox; PRs listed are exactly the repos with the Pull Requests switch on in Settings. Turning the switch off for all repos shows the "No repositories opted into Pull Requests" empty state with a working Settings link. Author/status/tag filters behave as before.

- [ ] **Step 7: Commit**

```bash
git add -A src/routes/pull-requests src/components/NoRepositories.tsx
git commit -m "Drive Pull Requests scope from settings opt-in

Removes the in-page repository picker and the prRepositories hook; the page
now shows repos with the Pull Requests feature switch enabled in Settings."
```

---

### Task 5: Dashboard and Gates — shared dashboard predicate

**Files:**
- Modify: `src/Wrangler.App/src/routes/dashboard.tsx`
- Modify: `src/Wrangler.App/src/routes/dashboard/-hooks/useWorkflows.ts`
- Modify: `src/Wrangler.App/src/routes/gates/-hooks/useGates.ts`
- Modify: `src/Wrangler.App/src/routes/gates/-components/Gates.tsx`

**Interfaces:**
- Consumes: `hasDashboardWorkflows` (Task 1).
- Produces: no new exports; behavior contract — Dashboard and Gates both operate on entries where `hasDashboardWorkflows(entry)` is true.

- [ ] **Step 1: Dashboard route guard**

In `src/Wrangler.App/src/routes/dashboard.tsx`, add the import:

```tsx
import { hasDashboardWorkflows } from "./settings/-hooks/repositoryFeatures";
```

and replace:

```tsx
    const hasRepos = selectedRepositories && selectedRepositories.length > 0;
```

with:

```tsx
    // Entries may be PR-only or security-only; the dashboard cares only about
    // repos with selected workflows.
    const hasRepos = selectedRepositories?.some(hasDashboardWorkflows) ?? false;
```

- [ ] **Step 2: `useWorkflows` uses the shared predicate**

In `src/Wrangler.App/src/routes/dashboard/-hooks/useWorkflows.ts`, add the import:

```ts
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";
```

and replace:

```ts
          // A repo with no selected workflows has nothing to show on the
          // dashboard, so exclude it here rather than fetch and render an
          // empty card (issue #172). The entry stays in settings/PR scope.
          repositories: selectedRepositories.filter((r) => (r.workflows?.length ?? 0) > 0),
```

with:

```ts
          // A repo with no selected workflows has nothing to show on the
          // dashboard, so exclude it here rather than fetch and render an
          // empty card (issue #172). The entry stays in settings/PR scope.
          repositories: selectedRepositories.filter(hasDashboardWorkflows),
```

(Behavior unchanged — this just centralises the predicate.)

- [ ] **Step 3: `useGates` filters to dashboard repos**

Replace the full contents of `src/Wrangler.App/src/routes/gates/-hooks/useGates.ts` with:

```ts
import { useQuery } from "@tanstack/react-query";
import { postGates } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";

export const useGates = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  // Gates follows the dashboard: only repos with selected workflows. The
  // unified list also holds PR-only/security-only entries, which have no
  // business here.
  const repositories = selectedRepositories
    .filter(hasDashboardWorkflows)
    .map((r) => ({ owner: r.owner, name: r.name }));

  return useQuery({
    queryKey: ["gates", repositories],
    queryFn: async () => {
      const result = await postGates({ body: { repositories } });
      return result.data ?? [];
    },
    enabled: repositories.length > 0,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
};
```

- [ ] **Step 4: Gates page guard**

In `src/Wrangler.App/src/routes/gates/-components/Gates.tsx`, add the import:

```tsx
import { hasDashboardWorkflows } from "../../settings/-hooks/repositoryFeatures";
```

and replace:

```tsx
  if (!selectedRepositories || selectedRepositories.length === 0) {
    return <NoRepositories />;
  }
```

with:

```tsx
  if (!selectedRepositories?.some(hasDashboardWorkflows)) {
    return <NoRepositories />;
  }
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Manual check**

Run: `npm run dev`.
Expected: Dashboard and Gates look exactly as before for repos with workflows. A repo opted into only Pull Requests or Security Alerts appears on neither page and does not suppress the `NoRepositories` empty state.

- [ ] **Step 7: Commit**

```bash
git add src/routes/dashboard.tsx src/routes/dashboard/-hooks/useWorkflows.ts src/routes/gates
git commit -m "Filter Dashboard and Gates to repos with selected workflows

The unified repository list now contains PR-only/security-only entries;
both pages use the shared hasDashboardWorkflows predicate."
```

---

### Task 6: Attention — union request + per-type client-side filtering

**Files:**
- Modify: `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.ts` (two new pure functions)
- Test: `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.test.ts` (append)
- Modify: `src/Wrangler.App/src/routes/attention/-hooks/useAttention.ts`
- Modify: `src/Wrangler.App/src/routes/attention/-components/Attention.tsx`

**Interfaces:**
- Consumes: `SelectedRepository`, `hasDashboardWorkflows` (Task 1).
- Produces (added to `repositoryFeatures.ts`):
  - `isAttentionOptedIn(repo: SelectedRepository): boolean` — repo participates in the Attention feed at all.
  - `interface AttentionItemLike { type: string; repositoryOwner: string; repositoryName: string }`
  - `isAttentionItemVisible(item: AttentionItemLike, repositories: SelectedRepository[]): boolean` — item's repo opted into that item's type. (The generated `AttentionItem` API type is structurally assignable to `AttentionItemLike`, keeping the pure module free of `src/api` imports.)

- [ ] **Step 1: Write the failing tests**

Append to `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.test.ts` (extend the existing import statement with `isAttentionOptedIn` and `isAttentionItemVisible`):

```ts
describe("isAttentionOptedIn", () => {
  it("is true for any of: workflows, pullRequests, securityAlerts", () => {
    expect(isAttentionOptedIn({ owner: "a", name: "r", workflows: [1] })).toBe(true);
    expect(isAttentionOptedIn({ owner: "a", name: "r", pullRequests: true })).toBe(true);
    expect(isAttentionOptedIn({ owner: "a", name: "r", securityAlerts: true })).toBe(true);
  });

  it("is false for an inert entry", () => {
    expect(isAttentionOptedIn({ owner: "a", name: "r", workflows: [] })).toBe(false);
    expect(isAttentionOptedIn({ owner: "a", name: "r", pullRequests: false, securityAlerts: false })).toBe(false);
  });
});

describe("isAttentionItemVisible", () => {
  const repositories: SelectedRepository[] = [
    { owner: "a", name: "dash", workflows: [1] },
    { owner: "a", name: "pr", workflows: [], pullRequests: true },
    { owner: "a", name: "sec", workflows: [], securityAlerts: true },
  ];

  const item = (type: string, name: string) => ({ type, repositoryOwner: "a", repositoryName: name });

  it("shows each item type only for repos opted into it", () => {
    expect(isAttentionItemVisible(item("WorkflowFailure", "dash"), repositories)).toBe(true);
    expect(isAttentionItemVisible(item("WorkflowFailure", "pr"), repositories)).toBe(false);
    expect(isAttentionItemVisible(item("PullRequestReview", "pr"), repositories)).toBe(true);
    expect(isAttentionItemVisible(item("PullRequestReview", "sec"), repositories)).toBe(false);
    expect(isAttentionItemVisible(item("SecurityAlert", "sec"), repositories)).toBe(true);
    expect(isAttentionItemVisible(item("SecurityAlert", "dash"), repositories)).toBe(false);
  });

  it("hides items for unknown repos and unknown types", () => {
    expect(isAttentionItemVisible(item("WorkflowFailure", "missing"), repositories)).toBe(false);
    expect(isAttentionItemVisible(item("SomethingNew", "dash"), repositories)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `isAttentionOptedIn` / `isAttentionItemVisible` are not exported.

- [ ] **Step 3: Implement the two functions**

Append to `src/Wrangler.App/src/routes/settings/-hooks/repositoryFeatures.ts`:

```ts
/** A repo participates in the Attention feed if it is opted into anything. */
export const isAttentionOptedIn = (repo: SelectedRepository): boolean =>
  hasDashboardWorkflows(repo) || repo.pullRequests === true || repo.securityAlerts === true;

/**
 * Structural stand-in for the generated AttentionItem API type, so this pure
 * module never imports from src/api.
 */
export interface AttentionItemLike {
  type: string;
  repositoryOwner: string;
  repositoryName: string;
}

/**
 * The backend returns every item type for every repo in the request; each
 * item is shown only if its repo opted into that item's feature.
 */
export const isAttentionItemVisible = (
  item: AttentionItemLike,
  repositories: SelectedRepository[],
): boolean => {
  const repo = repositories.find((r) => r.owner === item.repositoryOwner && r.name === item.repositoryName);
  if (!repo) return false;
  switch (item.type) {
    case "WorkflowFailure": return hasDashboardWorkflows(repo);
    case "PullRequestReview": return repo.pullRequests === true;
    case "SecurityAlert": return repo.securityAlerts === true;
    default: return false;
  }
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Send the union from `useAttention`**

Replace the full contents of `src/Wrangler.App/src/routes/attention/-hooks/useAttention.ts` with:

```ts
import { useQuery } from "@tanstack/react-query";
import { postAttention } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { isAttentionOptedIn } from "../../settings/-hooks/repositoryFeatures";

export const useAttention = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  // Union of every opted-in repo; the component filters items per type on the
  // way back (the endpoint takes one list and returns all item types).
  const repositories = selectedRepositories
    .filter(isAttentionOptedIn)
    .map((r) => ({ owner: r.owner, name: r.name }));

  return useQuery({
    queryKey: ["attention", repositories],
    queryFn: async () => {
      const result = await postAttention({ body: { repositories } });
      return result.data ?? [];
    },
    enabled: repositories.length > 0,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });
};
```

- [ ] **Step 6: Filter items per type in `Attention.tsx`**

In `src/Wrangler.App/src/routes/attention/-components/Attention.tsx`, make these edits:

6a. Add the import:

```tsx
import { isAttentionOptedIn, isAttentionItemVisible } from "../../settings/-hooks/repositoryFeatures";
```

6b. Replace the `visibleItems` memo:

```tsx
  const visibleItems = useMemo(
    () => (items ?? []).filter((item) => typeSet.size === 0 || typeSet.has(item.type)),
    [items, typeSet],
  );
```

with (per-repo opt-in filtering happens before the type chips, and drives the empty state):

```tsx
  const optedInItems = useMemo(
    () => (items ?? []).filter((item) => isAttentionItemVisible(item, selectedRepositories)),
    [items, selectedRepositories],
  );

  const visibleItems = useMemo(
    () => optedInItems.filter((item) => typeSet.size === 0 || typeSet.has(item.type)),
    [optedInItems, typeSet],
  );
```

6c. Replace the guard:

```tsx
  if (!selectedRepositories || selectedRepositories.length === 0) {
    return <NoRepositories />;
  }
```

with:

```tsx
  if (!selectedRepositories?.some(isAttentionOptedIn)) {
    return <NoRepositories />;
  }
```

6d. Replace:

```tsx
  const hasItems = !!items && items.length > 0;
```

with:

```tsx
  const hasItems = optedInItems.length > 0;
```

(so the filter chips and "Nothing is waiting on you" empty state reflect what is actually shown, not discarded items).

- [ ] **Step 7: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 8: Manual check**

Run: `npm run dev`, open Attention.
Expected: security alerts appear only for repos with Security Alerts on; workflow failures only for repos with dashboard workflows; review requests only for PR-opted repos. With everything switched off, the `NoRepositories` empty state shows.

- [ ] **Step 9: Commit**

```bash
git add src/routes/settings/-hooks/repositoryFeatures.ts src/routes/settings/-hooks/repositoryFeatures.test.ts src/routes/attention
git commit -m "Filter Attention feed by per-repo feature opt-in

Sends the union of opted-in repos and filters returned items client-side:
workflow failures for dashboard repos, review requests for PR repos, and
security alerts for security-opted repos."
```

---

### Task 7: Full verification and QA sweep

**Files:**
- No planned changes — fixes only if verification fails.

**Interfaces:**
- Consumes: everything above.
- Produces: a verified branch ready for PR.

- [ ] **Step 1: Full automated verification**

```bash
cd src/Wrangler.App
npm test && npm run lint && npm run build
```

Expected: all pass with zero errors.

- [ ] **Step 2: Confirm no stale references**

```bash
git grep -n "prRepositories\|WorkflowSelector\|usePrRepositories" -- src
```

Expected: **no matches** in `src/Wrangler.App/src` (the localStorage key name appears only inside `repositoryFeatures.ts` as `PR_REPOSITORIES_KEY = "prRepositories"`, which is the one allowed match).

- [ ] **Step 3: Migration QA against real stored state**

Run: `npm run dev`. In the browser devtools console, simulate a pre-migration user, then reload:

```js
localStorage.removeItem("repositoriesSchemaVersion");
localStorage.setItem("repositories", JSON.stringify([{ owner: "AndrewMcLachlan", name: "Wrangler", workflows: [1] }]));
localStorage.setItem("prRepositories", JSON.stringify([{ owner: "AndrewMcLachlan", name: "Wrangler" }, { owner: "AndrewMcLachlan", name: "moo-ds" }]));
location.reload();
```

Expected after reload (devtools → Application → Local Storage):
- `repositoriesSchemaVersion` = `2`
- `prRepositories` key deleted
- `repositories` contains Wrangler with `securityAlerts: true, pullRequests: true` and moo-ds with `workflows: [], pullRequests: true, securityAlerts: false`
- Dashboard shows only Wrangler; Pull Requests shows both; Attention shows security alerts only for Wrangler.

- [ ] **Step 4: Page sweep**

With the dev server running, click through Dashboard, Pull Requests, Attention, Gates, and Settings. Expected: no console errors, all empty states render with working Settings links, and toggling switches in Settings is reflected on the other pages after navigation.

- [ ] **Step 5: Commit any verification fixes and push**

```bash
git status   # commit any fixes made during QA with a descriptive message
git push -u origin feature/per-repo-feature-opt-in
```

Then open a PR to `main` titled "Per-repo feature opt-in" summarising: unified localStorage model + migration, Settings feature switches, PR page repo picker removal, Gates/Dashboard predicate, Attention per-type filtering.
