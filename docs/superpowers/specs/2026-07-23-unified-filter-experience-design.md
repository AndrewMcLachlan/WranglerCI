# Unified Filter Experience — Design

**Date:** 2026-07-23
**Status:** Approved (design sections reviewed in brainstorming session)
**Scope:** Wrangler frontend (`src/Wrangler.App`) + one prerequisite fix in `moo-ds` (`K:\Dev\Libraries\MooApp\moo-ds`). No backend changes.

## Problem

Phase 1 (per-repo feature opt-in, spec 2026-07-22) fixed *what* each page shows.
This phase fixes *how* users filter it. Today every page speaks a different
filter dialect:

| Page | Filter | Control | Notes |
|---|---|---|---|
| Dashboard | Branches | free-text input + CloseBadge row | via `DashboardProvider` context |
| Pull Requests | Authors | bespoke typeahead + separate gold badge row | server-side scope, react-query-wrapped storage |
| Pull Requests | Status | toggle chips with colour dots | `status-chip` CSS |
| Pull Requests | Include/Exclude tags | two moo-ds ComboBoxes | `colourField` pills |
| Attention | Item type | toggle chips | `attention-chip` CSS — near-identical duplicate of `status-chip` |
| Gates | — | — | |

Three "add a value" idioms, duplicated chip CSS, and no shared layout.

## Decisions

- **One control everywhere: the moo-ds ComboBox.** No mixing of filter styles.
  Toggle chips, the bespoke author typeahead, and the branch free-text input
  all become ComboBoxes.
- **Coloured dots stay** — in the ComboBox option list and selected pills,
  using moo-ds as-is (no library change needed for dots).
- **Shared pieces live in-app** (`src/components/filters/`), not in moo-ds.
  They can graduate to moo-ds later once the API settles.
- **Fix moo-ds first** for the one real gap (creatable + search, below), then
  bump Wrangler. Sequencing: moo-ds fix + release → `npm run update-moo` →
  Wrangler refactor, one Wrangler PR.
- **No filter-logic changes.** Same predicates, same localStorage keys, same
  query keys, same empty-selection semantics. This phase swaps controls only.

## 1. moo-ds prerequisite (the only library change)

**Fix: `creatable` must work when `search` is set.** In `ComboBoxInput`, the
creatable "Add '…'" flow lives in the non-`search` branch of `onChange`, so a
ComboBox with a `search` callback never offers to add free text.

Contract for the fix: after `search(input)` returns its items, if `creatable`
is true and no returned item's label (`labelField(item).toString()`, matching
the existing non-search comparison) equals the typed text case-insensitively,
set `newItem` with `label = createLabel(input)` so the "Add '…'" option
renders — the same `newItem`/`onCreate` flow as the non-search path. Covered
by a unit test in the moo-ds repo.

Everything else needed already works in the released moo-ds:

- The dropdown renders `labelField(item)` directly and `labelField` returns
  `ReactNode` — coloured dots in the option list work today.
- Caveat that shapes the design: moo-ds's *default* text filtering calls
  `labelField(i).toString()`, which breaks on ReactNode labels. Any ComboBox
  using a ReactNode label must therefore supply its own `search` callback that
  filters on a plain string field (see `optionSearch` below).
- `colourField` colours the selected pills (used by tag filters today).
- `clearable`, `multiSelect`, pill overflow handling: all existing.

Release moo-ds normally; Wrangler consumes via `npm run update-moo`.

## 2. Shared filter language (in Wrangler)

New `src/components/filters/` with two pure, unit-testable helpers:

- **`dotLabel(colourClass: (option) => string)`** — returns a
  `labelField`-compatible renderer:
  `(option) => <><span className={`dot ${colourClass(option)}`} />{option.label}</>`.
  Dots appear in the dropdown options and inside the selected pills.
- **`optionSearch(options, field)`** — returns a `search` callback doing
  case-insensitive substring filtering on a plain string field; empty input
  returns all options. Used by every fixed-option picker (status, attention
  type) because their ReactNode labels break moo-ds's default filtering.

Layout: a shared **`.filter-bar` / `.filter-group`** CSS convention (new
`src/css/components/filter-bar.css`) modeled on the existing tag-filter-group
pattern — a small label beside each ComboBox (`Status ▸ [picker]`), uniform
control sizing, wrap behaviour, and the page's action button pinned right.

Deleted/consolidated CSS: the `status-chip` and `attention-chip` blocks (and
their dot hover states), `filters.css`'s branch-filter styles, the author
typeahead styles (`author-filter`, `author-input`, `author-suggestions`,
`author-suggestion-*`, `author-badges`) in `pull-requests.css`, and the
`attention-filters` block in `attention.css`. Item-display styles (attention
list badges, PR label pills, status dots used in table cells) are untouched.

Persistence is untouched: same keys (`branchFilter`, `prStatusFilter`,
`prIncludeTags`, `prExcludeTags`, `prAuthors`, `attentionTypeFilter`), same
hooks. `DashboardProvider` stays — it is what syncs the branch filter between
the dashboard layout and `useWorkflows` in the same document (moo-ds
`useLocalStorage` instances sync only across tabs via the `storage` event).
`prAuthors` keeps its react-query wrapper (server-side scope shared with
`usePullRequests`).

## 3. Page-by-page

**Dashboard** — `Filters.tsx`: the free-text input + CloseBadge row becomes
one `Branches ▸ [ComboBox]` group; `multiSelect` + `creatable` + `clearable`,
no suggestion items (typing offers "Add 'release/1.2'"), selected branches as
pills inside the control. Provider and `branchFilter` key unchanged.

**Pull Requests** — the control bar becomes four uniform groups + the action
button:

- `Authors ▸ [ComboBox]` — `search` wired to the existing debounced GitHub
  user search (`useUserSearch`), `creatable` (post-fix) for logins search
  won't surface (e.g. `dependabot[bot]`). Suggestion labels are plain login
  strings — the avatar/name dropdown goes away, because moo-ds's creatable
  duplicate-check compares label text. The separate full-width gold
  author-badge row is deleted; selections are pills in the control.
  Selection changes write through `useUpdatePrAuthors` as today.
- `Status ▸ [ComboBox]` — replaces the four toggle chips. Fixed options
  (Success/Failure/Pending/Unknown) with their existing dot colours via
  `dotLabel` + `optionSearch`. Not creatable.
- `Include ▸ [ComboBox]` / `Exclude ▸ [ComboBox]` — existing tag pickers
  restyled into the shared group convention; tag colours via `colourField`
  and the neutral-colour fallback for persisted-but-unloaded tags, as today.
- Approve button pinned right.

**Attention** — the three type chips become `Type ▸ [ComboBox]`; fixed
options with the existing dot colours (red/amber/purple) via `dotLabel` +
`optionSearch`. The "chips render only when items exist" quirk is removed —
the filter bar renders whenever the page body does, consistent with the PR
page.

**Gates** — no filters (unchanged), but its `.controls` row adopts the shared
filter-bar styling so the Approve button placement matches the PR page.

## 4. Behaviour details and edge cases

- Filter logic, predicates, and query keys are byte-identical to today; only
  the input controls change.
- Empty selection = no constraint (status, type, include tags, branches);
  exclude-wins-over-include for tags stays; authors-empty still means the PR
  query does not fire (`enabled` guard unchanged).
- Status/type pickers: typing filters the 3–4 fixed options locally via
  `optionSearch`; no remote search, no creatable.
- Removing a pill or using the ComboBox clear control writes the same
  empty-array semantics the current controls write.
- A persisted tag absent from all loaded PRs keeps its neutral fallback
  colour (`FALLBACK_TAG_COLOUR`), moved as-is.

## Error handling

No new failure modes: all state transitions go through the existing hooks.
The author picker's remote search already degrades to no suggestions on
error/loading (react-query); creatable free entry still works in that state.

## Testing

- **Wrangler (Vitest):** units for `dotLabel` (renders the dot class + label
  text) and `optionSearch` (case-insensitive substring, empty input → all
  options, no match → empty).
- **moo-ds (its own repo):** unit test for creatable-with-search — typed text
  matching no search result offers "Add '…'" and fires `onCreate`; matching
  text does not.
- **Manual QA:** each page's filters exercise add/remove/clear/persistence
  (reload) and the PR author flow including a bot login.

## Out of scope

- Moving the shared filter components into moo-ds (revisit once stable).
- Any new filter types (e.g. repository filter on non-PR pages).
- Server-side filtering changes or backend work of any kind.
- Broader moo-ds ComboBox improvements (e.g. ReactNode-safe default
  filtering, avatar-capable creatable comparison) beyond the one contract fix.
