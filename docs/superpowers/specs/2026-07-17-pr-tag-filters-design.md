# Pull Request Tag Filters — Design

Date: 2026-07-17
Status: Approved (pending spec review)

## Summary

Add **inclusive** and **exclusive** tag filters to the Pull Request view. "Tags"
are the GitHub PR labels that already ship on every pull request. Filtering is
performed entirely client-side against the labels already present on loaded PRs;
no backend change and no API-client regeneration are required. Both filters are
persisted to `localStorage` and support typeahead suggestions.

## Context

- PR view: `src/Wrangler.App/src/routes/pull-requests/-components/PullRequests.tsx`
- Each `PullRequestModel` already carries `labels?: Array<PullRequestLabel>` where
  `PullRequestLabel = { name: string; color: string }` (6-char hex, no leading `#`).
- Labels are already rendered in the Title cell via the moo-ds `Badge` component.
- Existing precedent for a client-side, persisted filter: the status filter —
  `usePrStatusFilter.ts` uses moo-ds `useLocalStorage<CheckStatus[]>("prStatusFilter", [])`
  and is applied in the `visiblePullRequests` useMemo.
- Picker precedent: moo-ds `ComboBox` with `multiSelect` + `colourField`, already
  used in `dashboard/-components/shared/RepositorySelector.tsx`.

## Decisions

1. **Tag source:** the deduplicated union of labels across the **currently-loaded
   PRs** (dedup by `name`, first-seen `color`). Zero backend cost; semantically
   exact because a PR can only be matched by a label it actually carries. A label
   that exists in a repo but is on no open PR simply never appears as a suggestion
   (and would match nothing anyway).
2. **Include logic:** OR / ANY — a PR passes if it has at least one selected
   include tag. An empty include set means "no include constraint" (show all).
3. **Exclude logic:** a PR is hidden if it has any selected exclude tag.
4. **Collision (same tag in both include and exclude):** pessimistic — the PR is
   hidden. This falls out naturally from applying exclude after include. No UI
   guard prevents selecting the same tag in both.
5. **Persistence:** both filters persist across reloads.
6. **Picker component:** moo-ds `ComboBox` with `multiSelect`, `colourField`,
   typeahead search.
7. **Layout:** two separate labeled controls — "Include tags" and "Exclude tags" —
   in the existing `.controls` bar, side by side (stacking on narrow widths),
   consistent with the existing author/status filter grouping.

## Components

### `usePrTagFilter.ts` (new hook)

Location: `src/Wrangler.App/src/routes/pull-requests/-hooks/usePrTagFilter.ts`.
Mirrors `usePrStatusFilter.ts`. Backed by moo-ds `useLocalStorage`, storing two
arrays of label **names** (not name+color — names are the match key and survive
label recoloring):

- `useLocalStorage<string[]>("prIncludeTags", [])`
- `useLocalStorage<string[]>("prExcludeTags", [])`

Exposes the two arrays and their setters. May be one hook returning both, or two
sibling hooks — implementer's choice, following the status-filter shape.

### `PullRequests.tsx` changes

- **Available tags:** a `useMemo` producing the deduplicated union of labels
  across `pullRequests` (dedup by `name`, keep first `color`). Sort by name for
  stable suggestion ordering.
- **ComboBox `items`:** union of (available tags) + (currently-selected include or
  exclude tags that are absent from available tags), so a persisted-but-absent tag
  still renders as a removable colored chip. For a selected tag with no known
  color, fall back to a neutral color constant.
- **Filtering:** extend the existing `visiblePullRequests` useMemo, layered after
  the status filter. For each PR, build `L = new Set(pr.labels.map(l => l.name))`:
  - `includePass = include.length === 0 || include.some(t => L.has(t))`
  - `excludePass = !exclude.some(t => L.has(t))`
  - keep the PR when `includePass && excludePass`.
- **UI:** two `ComboBox` controls (Include / Exclude) in the `.controls` bar,
  wired to the hook's setters via `onChange`/`onAdd`/`onRemove`.

### CSS

Scoped rules under `@scope (.pull-requests)` in
`src/Wrangler.App/src/css/components/pull-requests.css` for the two new controls,
matching the existing filter styling.

## Data Flow

1. `usePullRequests` loads PRs (unchanged); each PR carries its labels.
2. `availableTags` useMemo derives the suggestion list from loaded PRs.
3. `usePrTagFilter` provides persisted include/exclude name arrays.
4. `visiblePullRequests` applies status → include → exclude, then renders in the
   `DataGrid`.
5. Selecting/removing tags updates the hook state, which writes to `localStorage`
   and re-renders.

## Edge Cases

- **Persisted tag absent from loaded PRs:** still applied as a filter and still
  rendered as a selected chip (via the `items` union above). With OR include
  semantics, an include set of only absent tags yields an empty list — correct.
- **Same tag in include and exclude:** PR carrying it is hidden (pessimistic).
- **Label recoloring / renaming upstream:** matching is by name; a renamed label
  effectively becomes a different tag (expected). Colors are always read live from
  loaded PRs, so recoloring is reflected automatically.
- **No labels on any loaded PR:** suggestion lists are empty; controls render but
  offer nothing to pick (aside from any persisted selections).

## Out of Scope

- Backend cross-repo label aggregation endpoint.
- Server-side tag filtering (request DTO changes / client regen).
- Creating new labels from the filter UI.

## Testing

- Unit-level: the include/exclude/collision predicate against representative PR
  label sets (empty include, OR match, exclude hides, collision hides, absent
  persisted tag).
- Manual: verify persistence across reload, chip rendering for absent persisted
  tags, and consistency with the status filter grouping.
