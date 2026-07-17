# PR View Filters Rethink (#143) — Design

Date: 2026-07-18
Status: Approved

## Summary

The Pull Requests view reuses the workflow dashboard's "selected repositories"
list and a free-text author input. Issue #143 asks for two independent changes:

- **Part A** — give the PR view its own repository scope, independent of the
  workflow dashboard.
- **Part B** — replace the free-text author filter with a debounced GitHub-user
  typeahead.

Delivered as one PR closing #143, with Part A and Part B as separate commits.

## Part A — Independent PR repository scope

### Hook

`src/Wrangler.App/src/routes/pull-requests/-hooks/usePrRepositories.ts`
(+ `useUpdatePrRepositories`), mirroring `usePrAuthors.ts` (react-query +
localStorage, so the value feeds the PR fetch query key and edits refetch).

- localStorage key: `"prRepositories"`, storing `{ owner: string, name: string }[]`.
- **Seeding (read-time default):** if the `"prRepositories"` key is absent, fall
  back to the current `"repositories"` (dashboard) selection mapped to
  `{ owner, name }`. Once the mutation writes the key, the scope is independent;
  an intentionally-emptied scope persists as `[]` because the key now exists.
  This distinguishes "never configured → seed" from "emptied on purpose".

### Consumption

- `usePullRequests.ts`: use `usePrRepositories()` instead of
  `useSelectedRepositories()`. Shapes already match (`{ owner, name }`), and
  `repositories` is already in the query key + the `enabled` guard.
- `PullRequests.tsx`: drop the settings-oriented `NoRepositories` guard. Repos
  are now chosen inline, so an empty scope shows the picker plus an empty grid
  ("Select repositories to see pull requests."). The fetch stays gated (no fetch
  until repositories **and** authors are non-empty).

### Picker UI

A moo-ds `ComboBox multiSelect` at the top of the PR controls, fed by
`useRepositories()` (the full accessible list from `GET /repositories`).
Suggestions are entirely client-side (list already loaded), so ComboBox fits.

- Bridge shape: `Repository.owner` is a `User` object → map items to
  `{ owner: r.owner.login, name: r.name, id: r.id, label: r.fullName ?? owner/name }`.
- `labelField` = full name, `valueField` = `owner/name`, `selectedItems` from
  `prRepositories`, `onChange` → `setPrRepositories(items.map({owner,name}))`.

## Part B — Debounced GitHub-user author typeahead

### Backend

New endpoint `GET /users/search?q={query}`:

- Handler `UsersHandler.Handle` (static, per convention), mapped in `Program.cs`.
- Service method wrapping Octokit `Search.SearchUsers(new SearchUsersRequest(q))`,
  mapped to a lean model `UserSearchResult { Login, Name?, AvatarUrl? }`, top ~10.
- Short-TTL distributed cache per normalised query (reuse `GitHubService`
  cache helpers). On rate-limit/403, return an empty list gracefully rather than
  erroring the typeahead.
- Requires client regen: `dotnet build` (emits `openapi-v1.json`) →
  `npm run generate`.

### Frontend

- `useUserSearch(query)` — react-query keyed on the **debounced** query
  (`use-debounce`, already a dependency), enabled only when the debounced query
  length ≥ 2. Calls the generated `getUsersSearch`.
- **Control:** enhance the existing author input + `CloseBadge` chips rather than
  use `ComboBox` — moo-ds `ComboBox`'s `search` is client-side only
  (`(input) => TItem[]`, no async/input-change hook), which cannot drive a server
  query. So: keep the controlled input, add a debounced suggestions dropdown
  (avatar + login) beneath it; clicking a suggestion adds a chip. **Typing an
  exact login + Enter still adds it** (creatable), preserving the ability to add
  bots like `dependabot[bot]`/`renovate[bot]` (the current defaults) that user
  search won't surface. Existing free-text add semantics are retained.

## Data Flow

1. `useRepositories` → repo picker options (Part A).
2. `usePrRepositories` (seeded from dashboard selection) → PR fetch scope.
3. Author input text → debounced → `useUserSearch` → suggestions dropdown.
4. Selected authors (strings) + repositories feed `["pullRequests", repos, authors]`.
5. Backend filters PRs by author server-side (unchanged).

## Edge Cases

- **Seeded vs emptied scope:** key-absent seeds from dashboard; key-present-empty
  stays empty.
- **Bots / exact logins:** always addable via free-text Enter, independent of
  search results.
- **Search rate limit (~30/min):** mitigated by ≥2-char minimum, debounce, and
  per-query caching; 403 returns empty suggestions, not an error.
- **Repo owner shape mismatch:** `Repository.owner.login` bridged to flat
  `{ owner, name }` for storage and the PR request.

## Out of Scope

- Changing server-side author filtering semantics.
- Collaborator/org-member based suggestions (chose GitHub user search).
- #146's "awaiting my review" cut (separate issue).

## Testing

- Frontend `npm run build`, backend `dotnet build`.
- Manual: repo scope independence + seeding, author typeahead suggestions,
  exact-login/bot entry, persistence across reload.
