# View & approve workflow deployment gates

**Issue:** [#142 — View and approve workflow gates from within Wrangler](https://github.com/AndrewMcLachlan/WranglerCI/issues/142)

## Problem

When a workflow run is paused at an environment / deployment protection rule (a
"gate"), the dashboard surfaces the waiting state — but acting on it requires
leaving Wrangler, opening the run on github.com, and approving there. For someone
triaging multiple repositories from the dashboard at once, that round-trip per
gated run is exactly the friction Wrangler exists to remove. There is also no way
today to batch-approve a handful of gates (e.g. "approve all my pending Dependabot
deploys") without going repo-by-repo on GitHub.

## Scope

**v1: approve only.** A dedicated page that lists pending deployment gates across
the selected repositories and lets the user batch-approve them. Mirrors the
existing **Pull Requests** batch-approve-and-merge flow.

**Out of scope (deferred):** rejecting gates, and attaching a review comment. The
GitHub review API accepts an empty comment, so approve-only is a clean subset.

## Architecture

The feature is a thin vertical slice that follows existing conventions exactly:
a `GitHubService`-derived backend service exposed through minimal-API handlers,
consumed by a TanStack-Router page with React Query hooks. It reuses the
established cross-repo fan-out pattern (semaphore gate + `Jitter` + `OctoCall`)
and the Pull Requests page's select/approve/results interaction.

### GitHub API note

Octokit 14 exposes the **write** side of pending deployments
(`IActionsWorkflowRunsClient.ReviewPendingDeployments`) but **no typed read**.
Listing what is waiting — and crucially the per-user `current_user_can_approve`
flag — must come from the REST endpoint directly:

```
GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments
```

via `gitHubClient.Connection.Get<PendingDeploymentResponse[]>(
ApiUrls.ActionsWorkflowRunPendingDeployments(owner, repo, runId), ...)` with a
locally-defined response DTO.

## Backend

### Models (`src/Wrangler.Api/Models/Gates/`)

- **`DeploymentGateModel`** — the unit surfaced to the UI: one per *(waiting run ×
  pending environment)*.
  - `RepositoryOwner`, `RepositoryName`
  - `WorkflowRunId`, `RunNumber`, `WorkflowName`, `HeadBranch`, `Event`, `HtmlUrl`
  - `CreatedAt`, `UpdatedAt`
  - `EnvironmentId`, `EnvironmentName`
  - `CurrentUserCanApprove` (bool) — drives row selectability in the UI.
- **`PendingDeploymentResponse`** — internal DTO deserialising the REST payload:
  `environment { id, name }`, `current_user_can_approve`, `wait_timer`. Only the
  fields actually used are mapped.
- **`GateApprovalResult`** — mirrors `ApprovalResult`: `RepositoryOwner`,
  `RepositoryName`, `WorkflowRunId`, `EnvironmentName`, `Approved`, `Error?`.

### Service (`src/Wrangler.Api/Services/GateService.cs`)

`internal class GateService : GitHubService, IGateService` with a
`SemaphoreSlim _gate = new(8)`, matching `AttentionService` / `PullRequestService`.

- **`GetGatesAsync(GatesRequest request, CancellationToken ct)`**
  - Fan out across repositories.
  - Per repo: list workflow runs filtered to **waiting** status. If Octokit 14's
    typed run-status filter does not expose "waiting", fall back to listing recent
    runs and filtering client-side on `WorkflowRunStatus.Waiting`.
  - Per waiting run: `Connection.Get<PendingDeploymentResponse[]>(...)`.
  - Emit one `DeploymentGateModel` per pending deployment. Flatten and order by
    `UpdatedAt` descending (consistent with attention / PR ordering).
- **`ApproveGatesAsync(ApproveGatesRequest request, CancellationToken ct)`**
  - Group selected gates by *(owner, repo, runId)*; collect the environment ids.
  - Call `ReviewPendingDeployments(owner, repo, runId,
    new PendingDeploymentReview(envIds, <Approved>, ""))`.
  - Return one `GateApprovalResult` per gate; on failure, populate `Error` with
    GitHub's message (the same shape `ApproveAndMergeAsync` uses).

### Requests (`src/Wrangler.Api/Requests/`)

- **`GatesRequest`** — list of `{ Owner, Name }` repositories, modelled on
  `AttentionRequest`.
- **`ApproveGatesRequest`** — `IReadOnlyList<GateRef> Gates`, where
  `GateRef { Owner, Repo, RunId, EnvironmentId }`.

### Handlers & routing (`src/Wrangler.Api/`)

- `Handlers/GatesHandler.cs` → `POST /api/gates` (`.DisableAntiforgery()`, like the
  other list endpoints).
- `Handlers/ApproveGatesHandler.cs` → `POST /api/gates/approve` (mirrors
  `pull-requests/approve`; no `DisableAntiforgery`).
- Register `IGateService` in `Program.cs` (`AddScoped`).

### API client regeneration

After the backend changes, regenerate the frontend client per `CLAUDE.md`
(`npm run generate` against the running backend). Do **not** hand-edit
`src/api/`.

## Frontend (`src/Wrangler.App/`)

- **Route** `src/routes/gates.tsx` — thin `createFileRoute("/gates")` wrapper
  rendering `Gates`, matching `attention.tsx`.
- **Component** `src/routes/gates/-components/Gates.tsx` — a `DataGrid` modelled on
  `PullRequests.tsx`:
  - Columns: select checkbox (enabled only when `currentUserCanApprove`),
    Repository, `Workflow · #run`, Environment (badge), Branch, Updated,
    open-on-GitHub link.
  - "Approve Selected" toolbar button (disabled while none selected / in flight).
  - Per-result success toasts and a failure `Alert` list, like the PR page.
  - Optimistic removal of approved gates from the `["gates"]` cache, with selection
    cleared for approved rows and retained for failures.
  - `NoRepositories` when no repos are selected; empty state copy: "No deployment
    gates are waiting for approval."
- **Hooks** `src/routes/gates/-hooks/`:
  - `useGates` — query keyed on the selected repositories, calling `postGates`.
  - `useApproveGates` — mutation calling `postGatesApprove`, invalidating
    `["gates"]` and surfacing per-gate results (mirrors `useApprovePullRequests`).
- **Navigation** — add a "Gates" `Link` with a suitable moo-icon to the `top-nav`
  list in `src/layout/Layout.tsx`.

## Behaviour & edge cases

- **Non-approvable gates** are shown but not selectable (greyed checkbox), exactly
  like non-approvable PRs — preserves cross-repo visibility without misleading the
  user into thinking they can act.
- **Multiple pending environments on one run** → multiple rows; `ApproveGatesAsync`
  batches them into a single review call per run.
- **Approval failure** (lost permission, run already resolved/cancelled, race) →
  surfaced as an `Alert` carrying GitHub's error message; the row remains so the
  user can re-evaluate.
- **Rate limiting / throughput** — fan-out bounded by the existing semaphore;
  `OctoCall` already retries on abuse / secondary rate limits.

## Testing

- **Unit tests** in `tests/Wrangler.Tests` for `GateService`, with a mocked
  `IGitHubClient`:
  - grouping selected gates by run and collecting environment ids,
  - that `CurrentUserCanApprove` is mapped through from the REST payload,
  - that a per-run approval failure is reported per gate without aborting the
    other repos/runs.
- **Verification:** `dotnet build` (Api + tests), `npm run build`, and a manual
  smoke test against a repository with an environment protection rule (a pending
  deploy appears, selecting + approving clears it, GitHub shows the run resumed).

## Non-goals

- Rejecting gates and review comments (v2).
- Surfacing gates in the attention feed or inline on dashboard run cards — the
  dedicated page is the single home for v1.
- Auto-refresh / live updates beyond the existing React Query invalidation.
