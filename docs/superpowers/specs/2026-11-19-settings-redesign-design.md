# Settings screen redesign

## Why

The settings screen (one tab per org, repo sidebar, detail panel) works for small orgs. It breaks down when an org has many repos or a repo has many workflows: there's no way to find a repo or a workflow other than scrolling, and the side-by-side layout doesn't work on a phone. Wrangler is a generic tool, so the design can't assume any naming convention or org shape.

## Goals

- Get to any repo in a large org quickly.
- Work through a repo with many workflows without scrolling the whole list.
- Usable on a phone.

## Non-goals

- Bulk changes across repos (one repo at a time stays the model).
- New API data (sorting by activity, archived flags). The screen uses what `AccountModel`/`SettingsRepositoryModel` already provide.
- Grouping workflows by name pattern.

## Approaches

1. **Sidebar, fixed up** (chosen). Keep the tab-per-org sidebar and detail panel; add search, an "In use" group and a workflow filter; on a phone, list and detail become separate screens. Smallest change, and keeps the tab-per-org layout that already works.
2. Expandable list. One list per org; each repo opens in place. Same on phone and desktop, but a large monorepo pushes everything below it far down.
3. Table plus workflow panel. Feature switches inline per row, workflows in an offcanvas panel. Best for cross-repo changes, but the biggest change and not what was wanted.

## Design

### Repo sidebar
- A search box at the top filters repos by name (case-insensitive substring, client-side). Its placeholder shows the count ("Search 60 repos…").
- Repos are split into two groups, each sorted A–Z: **In use** (any of pull requests, security alerts or a dashboard workflow is on) and **All repos** (the rest). A group with no matches is hidden. Search filters both groups.
- The existing feature icons stay on each row.
- No-match state: "No repos match "x"".

### Repo detail
- Features (Pull requests, Security alerts) unchanged.
- Dashboard workflows gains a toolbar: a filter box (case-insensitive substring) and a count ("3 of 42 on dashboard").
- Select all / Clear become "Select shown" / "Clear shown" and act only on the workflows currently visible after the filter and toggle. They change only those workflows; others keep their state.
- The toolbar appears whenever the repo has workflows.

### Phone
- Below the app's existing narrow breakpoint, the tab shows either the repo list or the selected repo's detail, never both.
- The list shows first. Tapping a repo shows its detail with a "‹ All repos" back link at the top. Search text survives going back.
- Desktop keeps both side by side.

## Calls made (correct any of these)
- Default selected repo on desktop: the first **In use** repo, else the first repo.
- A repo that gains or loses its first enabled setting moves between groups immediately and stays selected.
- Filters (repo search, workflow filter) are per tab, in component state, not persisted.

## Left to the builder
- Exact breakpoint (reuse what `narrow.css` and the PR cards already use).
- moo-ds components for the search boxes and switches; styles global where they apply app-wide.
- Tests for the grouping, search and "shown" select/clear logic.
