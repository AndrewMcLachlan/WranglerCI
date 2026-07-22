# Per-Repo Feature Opt-In — Design

**Date:** 2026-07-22
**Status:** Approved (design sections reviewed in brainstorming session)
**Scope:** Frontend only (`src/Wrangler.App`). No backend or API changes.

## Problem

Repository selection is fragmented and the Pull Requests page is the visible symptom:

1. Repo selection lives in two divergent places — Settings (the `repositories`
   localStorage key, driving Dashboard/Gates/Attention) and an in-page ComboBox on
   the Pull Requests page (the `prRepositories` key). The PR control bar mixes
   *scope* (which repos) with *filters* (author/status/tags), which is confusing.
2. Security alerts have no opt-in: every dashboard repo produces security alerts
   in the Attention feed whether wanted or not.
3. There is no way to have a repo on the Pull Requests page or watched for
   security alerts without also putting it on the dashboard (Settings disables
   repos with no workflows).

## Constraints & decisions

- **No backend store.** All selection state stays in localStorage; the frontend
  POSTs repo lists to the backend per request. (Deliberate cost decision — no
  persistent backend storage until a paywall/org management exists.)
- **Gates follows dashboard workflows.** A repo appears on Gates if and only if it
  has dashboard workflows selected. No separate Gates toggle.
- **Migration seeds Security Alerts ON** for existing dashboard repos, preserving
  today's behavior.
- **Settings layout:** "Features" section (two switches) above the existing
  Dashboard Workflows checklist (Layout A from the mockups). There is no explicit
  "Dashboard" toggle — having workflows selected *is* being on the dashboard.
- The unified-filter redesign (consistent filter bars across pages) is **phase 2**,
  a separate spec.

## 1. Data model

Extend `SelectedRepository` in `src/routes/settings/-hooks/useSelectedRepositories.ts`;
the `repositories` localStorage key becomes the single source of truth and the
`prRepositories` key is retired.

```ts
export interface SelectedRepository {
  owner: string;
  name: string;
  workflows?: (number | string)[]; // dashboard + gates (unchanged)
  pullRequests?: boolean;          // NEW — repo appears on Pull Requests page
  securityAlerts?: boolean;        // NEW — security alerts shown in Attention feed
}
```

Membership predicates (absent flags read as `false`):

| Feature | Predicate |
|---|---|
| Dashboard | `(workflows?.length ?? 0) > 0` |
| Gates | `(workflows?.length ?? 0) > 0` (same list as Dashboard) |
| Pull Requests | `pullRequests === true` |
| Security alerts | `securityAlerts === true` |

An entry may exist with `workflows: []` and only feature flags set (e.g. a
PR-only repo). An entry with no workflows and no flags is inert but harmless;
the Settings mutation may prune such entries.

## 2. One-time migration

A pure `migrate()` function runs synchronously before the first read of the
`repositories` key, guarded by a `repositoriesSchemaVersion` localStorage key
(absent → migrate, then set to `"2"`; `"2"` → no-op).

Steps:

1. Parse `repositories` (default `[]`).
2. Every existing entry gets `securityAlerts: true` — today `useAttention`
   sends *all* entries (even ones with no workflows, e.g. after "Clear"), so
   this preserves current Attention behavior exactly.
3. Seed `pullRequests` from the old PR scope:
   - If the `prRepositories` key **exists**, entries matching an item in it get
     `pullRequests: true`. PR-scoped repos *not* in `repositories` are appended as
     `{ owner, name, workflows: [], pullRequests: true, securityAlerts: false }`.
   - If the key is **absent** (user never edited the PR scope), the old code
     seeded the PR page from `repositories` — so set `pullRequests: true` on all
     existing entries to preserve that behavior.
4. Write the result back, set `repositoriesSchemaVersion`, and delete the
   `prRepositories` key.

The migration is idempotent by construction (version guard) and never touches
the backend.

## 3. Settings UI (Layout A)

**`RepoSelector.tsx`**
- Remove the `disabled = (repo.workflows?.length ?? 0) === 0` logic and the
  `firstAvailable` restriction — every repo is selectable, since a repo can now
  be PR-only or security-only.
- Each left-nav row shows small feature-indicator icons for what is enabled:
  dashboard (has selected workflows), pull requests, security alerts. Icons are
  derived from the unified model, with accessible titles.

**`WorkflowSelector.tsx` → renamed `RepoFeatures.tsx`** (it is no longer only
workflows):
- Top: **Features** section — two switches:
  - *Pull Requests* → writes `pullRequests`
  - *Security Alerts* → writes `securityAlerts`
- Below: **Dashboard Workflows** checklist, unchanged (Select All / Clear).
- If the repo has no workflows, the checklist area shows a muted
  "No GitHub Actions workflows in this repository" note; the feature switches
  remain functional.
- The existing `commit()` pattern is extended to write the new flags. It must
  keep building fresh entries rather than mutating cached objects (the
  react-query cache-corruption fix from PR #200).

## 4. Consuming pages

**Pull Requests** (`PullRequests.tsx`, `-hooks/`):
- Remove the repo ComboBox and its supporting code (`repoOptions`,
  `selectedRepoOptions`, `useRepositories` usage, `useUpdatePrRepositories`)
  from the control bar — repo scope now lives only in Settings. This is the
  main wonkiness fix.
- Delete `usePrRepositories.ts`. `usePullRequests` derives its repo list from
  `useSelectedRepositories()` filtered by `pullRequests === true`.
- Empty state: when no repo has `pullRequests: true`, show
  "No repositories opted into Pull Requests — choose them in Settings" with a
  link to `/settings`.
- Author, status, and tag filters are untouched (phase 2).

**Dashboard** (`useWorkflows.ts`, `dashboard.tsx`):
- `useWorkflows` already filters to `workflows.length > 0` before POSTing —
  unchanged.
- The `hasRepos` guard in `dashboard.tsx` must change from
  `selectedRepositories.length > 0` to "any entry with selected workflows",
  since the list may now contain PR-only/security-only entries.

**Gates** (`useGates.ts`, `Gates.tsx`):
- `useGates` currently sends *all* entries. It must now filter to
  `(workflows?.length ?? 0) > 0`, since the unified list will routinely contain
  PR-only/security-only entries. (Minor behavior change: an entry whose
  workflows were cleared no longer appears on Gates — consistent with the
  "Gates follows dashboard workflows" decision.)

## 5. Attention feed

Attention mixes three item types with different opt-ins, but `postAttention`
takes a single repo list and returns all types. Frontend-only handling:

1. **Request:** `useAttention` sends the **union** of all opted-in repos — any
   entry where `workflows.length > 0 || pullRequests || securityAlerts`.
2. **Response filtering (client-side):** each returned item is kept only if its
   repo opted into that item's type:
   - `WorkflowFailure` → repo has dashboard workflows
   - `PullRequestReview` → repo has `pullRequests: true`
   - `SecurityAlert` → repo has `securityAlerts: true`
3. **Empty-state guard:** the `NoRepositories` guard in `Attention.tsx` triggers
   only when *no* repo is opted into *anything* (the union is empty).

Trade-off: the backend computes item types we discard for some repos (slight
over-fetch), but this avoids any backend change and adds no extra requests —
consistent with the no-backend-store constraint.

## Error handling

- `migrate()` wraps JSON parsing in try/catch; unparseable stored values are
  treated as `[]` (matches existing defensive parsing in `usePrRepositories`).
- Missing/absent flags are read as `false` everywhere — no entry shape is
  invalid.

## Testing

Follow the existing frontend test approach (Vitest). Key cases:

- **Migration:** version guard (runs once); seeds `securityAlerts: true` on
  existing entries; `prRepositories` present → flags matching entries and
  appends PR-only entries; `prRepositories` absent → `pullRequests: true` on
  all entries; deletes the old key; handles corrupt JSON.
- **Predicates/derivation:** `usePullRequests` repo list, `useGates` filter,
  `useAttention` union + per-type item filtering.
- **Settings:** toggling switches writes flags without mutating cached entries;
  workflow-less repo shows the muted note and working switches.

## Out of scope (phase 2 — separate spec)

- Unified filter bar component shared across Dashboard, Pull Requests,
  Attention, and Gates.
- Consistency work on status chips, tag ComboBoxes, and author typeahead.
- Dashboard branch-filter rework.
