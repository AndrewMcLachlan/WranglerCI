# Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the per-org settings tab usable with many repos and many workflows, and on a phone.

**Architecture:** Pure filtering/grouping functions in a new `settingsLists.ts` (unit-tested in node, like `repositoryFeatures.ts`), consumed by `RepoSelector` (search, In use / All repos groups, phone two-screen) and `RepoFeatures` (workflow toolbar). The phone behaviour is CSS-driven: both panes always render, a `showing-detail` class on the tab content decides which one is visible below 768px.

**Tech Stack:** React 19, TypeScript 7, TanStack Router, moo-ds, vitest (node environment; Wrangler has no `@testing-library/react`, so only pure logic is unit-tested).

**Spec:** `docs/superpowers/specs/2026-11-19-settings-redesign-design.md`

## Global Constraints

- All paths below are relative to `src/Wrangler.App/`.
- Use moo-ds components: `ClearableInput` (with `clearable`, `type="search"`, `placeholder`) for search/filter boxes, `Input.Switch` for switches. `SearchBox` has no placeholder prop, so don't use it.
- Constants camelCase. No comments explaining absence or alternatives (see `~/.claude/rules/code-comments.md`).
- CSS uses `@scope`; the narrow breakpoint is `@media (max-width: 767px)` (moo-ds md), as in `css/components/narrow.css`.
- en-AU spelling in prose; copy is sentence case: "Search 60 repos…", "In use", "All repos", "No repos match "x"", "Filter workflows…", "Selected only", "3 of 42 on dashboard", "Select shown", "Clear shown", "‹ All repos".
- Run `npm run test`, `npm run lint` and `npm run build` from `src/Wrangler.App`. CI doesn't run the frontend tests.
- Git: never force push, never shallow fetch, stage by explicit path, never revert working-tree changes you didn't make.

## Review Focus

1. Search text with surrounding whitespace ("  plat ") must match as if trimmed; an all-whitespace search shows everything.
2. On desktop, a selected repo that the search filters out stays shown in the detail pane (selection is not cleared by searching).
3. Stored workflow ids that are no longer in the repo's workflow list must not count towards "x of y" and must survive "Clear shown" / "Select shown".
4. An account with no repositories shows "No repositories" instead of empty groups.
5. Workflow ids are `number | string`; compare them with `===` exactly as the existing code does, never coerce.

---

### Task 1: Pure list logic

**Files:**
- Create: `src/routes/settings/-hooks/settingsLists.ts`
- Test: `src/routes/settings/-hooks/settingsLists.test.ts`

**Interfaces:**
- Consumes: `SelectedRepository`, `isAttentionOptedIn` from `./repositoryFeatures` (a repo is "in use" exactly when `isAttentionOptedIn` is true for its entry).
- Produces:
  - `matchesSearch(name: string, search: string): boolean` — case-insensitive substring on trimmed search; empty/whitespace search matches all.
  - `groupRepositories<T extends { owner: string; name: string }>(repositories: T[], selected: SelectedRepository[], search: string): { inUse: T[]; others: T[] }` — filtered by `matchesSearch`, each group sorted A–Z by name (`localeCompare`, case-insensitive).
  - `defaultRepository<T extends { owner: string; name: string }>(repositories: T[], selected: SelectedRepository[]): T | undefined` — first of `inUse` (empty search), else first of `others`.
  - `visibleWorkflows<T extends { id?: number | string; name: string }>(workflows: T[], selectedIds: (number | string)[], filter: string, selectedOnly: boolean): T[]` — keeps input order.
  - `selectedCount(workflows: { id?: number | string }[], selectedIds: (number | string)[]): number` — counts only ids present in `workflows`.
  - `setWorkflows(selectedIds: (number | string)[], shown: { id?: number | string }[], on: boolean): (number | string)[]` — adds (without duplicates) or removes the shown ids; leaves every other id, including stale ones, untouched.

- [ ] **Step 1: Write the failing tests**

Cover, with `SelectedRepository` fixtures built inline:
- `matchesSearch("platform", "  PLAT ")` is true; `matchesSearch("docs", "plat")` is false; `matchesSearch("docs", "   ")` is true.
- `groupRepositories` with repos `zeta, alpha, platform, web` where `platform` has `workflows: [1]` and `web` has `pullRequests: true`, and an entry `alpha` with `workflows: [], pullRequests: false, securityAlerts: false`: `inUse` names `["platform", "web"]`, `others` `["alpha", "zeta"]`. Same call with search `"a"`: `inUse` `["platform"]`, `others` `["alpha", "zeta"]`.
- `groupRepositories` matches entries on owner and name (a same-named repo under another owner is not in use).
- `defaultRepository` returns `platform` for the fixture above, `alpha` when nothing is selected, `undefined` for `[]`.
- `visibleWorkflows` with `[{id:1,name:"api: build"},{id:2,name:"web: build"},{id:3,name:"api: deploy"}]`, selected `[3]`: filter `"API"` → ids `[1,3]`; selectedOnly → `[3]`; both → `[3]`.
- `selectedCount` of those workflows with selected `[3, 99]` is `1`.
- `setWorkflows([3, 99], [{id:1},{id:3}], true)` contains exactly `3, 99, 1`; `setWorkflows([1, 3, 99], [{id:1},{id:3}], false)` is `[99]`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/routes/settings/-hooks/settingsLists.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the six functions in `settingsLists.ts`** with the signatures above. No React, no storage.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/routes/settings/-hooks/settingsLists.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/routes/settings/-hooks/settingsLists.ts src/routes/settings/-hooks/settingsLists.test.ts
git commit -m "Add settings list filtering and grouping"
```

### Task 2: Repo sidebar search, groups and phone two-screen

**Files:**
- Modify: `src/routes/settings/-components/RepoSelector.tsx`
- Modify: `src/css/components/settings/repo-selector.css`

**Interfaces:**
- Consumes: `groupRepositories`, `defaultRepository` from Task 1; `useSelectedRepositories`.
- Produces: `RepoFeatures` is rendered with `key={`${repo.owner}/${repo.name}`}` so its local filter state resets per repo (Task 3 relies on this).

- [ ] **Step 1: Implement**
  - State: `search` (string), `selectedRepo` (initialised lazily to `defaultRepository(account.repositories ?? [], selectedRepositories)`), `showingDetail` (boolean, false).
  - Sidebar: `ClearableInput` (`type="search"`, `clearable`, placeholder `Search ${count} repos…`) above the nav; then the "In use" group and the "All repos" group, each a heading (`<h4 className="repo-group">`) plus `Nav.Link`s rendered exactly as today (name + feature icons). Hide a group with no items. No matches: `<p className="no-matches">No repos match "{search.trim()}"</p>`. No repos at all: `<p className="no-matches">No repositories</p>`.
  - Clicking a repo sets `selectedRepo` and `showingDetail = true`.
  - Wrapper gets `className={classNames("repo-selector-body", { "showing-detail": showingDetail })}`; the detail pane starts with `<button type="button" className="btn btn-link repo-back" onClick={() => setShowingDetail(false)}>‹ All repos</button>`.
  - The selected repo's detail is shown even when the search hides its sidebar row.
- [ ] **Step 2: CSS** in `repo-selector.css`: `.repo-group` small, `--body-colour-dim`, weight 600, sentence case (no `text-transform`); `.repo-back` hidden at desktop widths. In `@media (max-width: 767px)`: `.sidebar` takes full width; `.showing-detail .sidebar` hidden; `:not(.showing-detail) .section-content` hidden; `.repo-back` shown. Keep the sidebar scrollable independently of the page on desktop only if it already is; don't introduce new scroll containers.
- [ ] **Step 3: Verify**

Run: `npm run build` and `npm run lint`
Expected: build succeeds; no new lint warnings in changed files.

- [ ] **Step 4: Commit**

```
git add src/routes/settings/-components/RepoSelector.tsx src/css/components/settings/repo-selector.css
git commit -m "Add repo search, in-use group and phone layout to settings"
```

### Task 3: Workflow toolbar

**Files:**
- Modify: `src/routes/settings/-components/RepoFeatures.tsx`
- Modify: `src/css/components/settings/repo-features.css`

**Interfaces:**
- Consumes: `visibleWorkflows`, `selectedCount`, `setWorkflows` from Task 1; the existing `commit` helper.

- [ ] **Step 1: Implement**
  - State: `filter` (string), `selectedOnly` (boolean).
  - `shown = visibleWorkflows(repository.workflows ?? [], workflows, filter, selectedOnly)`.
  - When the repo has workflows, render a `.workflow-toolbar` under the "Dashboard Workflows" heading: `ClearableInput` (`type="search"`, `clearable`, placeholder "Filter workflows…"), `Input.Switch` labelled "Selected only", then a line with `{selectedCount(...)} of {total} on dashboard` and the two link buttons "Select shown" (`commit({ workflows: setWorkflows(workflows, shown, true) })`) and "Clear shown" (`… false`).
  - The list renders `shown`. When `shown` is empty: `<p className="no-workflows">No workflows match.</p>`.
  - Replace the feature and workflow `<li className="form-check form-switch">` markup with `Input.Switch` (same ids, labels, checked and onChange) if its rendered markup gives the same look; if it doesn't, leave the existing markup.
  - Remove `selectAll` and `clear`.
- [ ] **Step 2: CSS** in `repo-features.css`: `.workflow-toolbar` flex, wraps, gap 0.5rem, filter box `flex: 1; min-width: 12rem`; count line `--body-colour-dim`, 0.85rem.
- [ ] **Step 3: Verify**

Run: `npm run test`, `npm run lint`, `npm run build`
Expected: all tests pass, build succeeds, no new lint warnings.

- [ ] **Step 4: Commit**

```
git add src/routes/settings/-components/RepoFeatures.tsx src/css/components/settings/repo-features.css
git commit -m "Add workflow filter and shown-only select to settings"
```
