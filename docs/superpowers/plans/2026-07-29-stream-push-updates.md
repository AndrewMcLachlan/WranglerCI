# Stream Push Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SSE event stream *update the screen from the event payload* instead of triggering GitHub API refetches, so a live session consumes (near) zero GitHub API quota.

**Architecture:** The webhook delivery already contains the changed entity. The backend maps that payload to the same model the UI already renders (`WorkflowRunModel`, PR metadata) — **no GitHub API call** — and broadcasts the model over SSE. The frontend merges the pushed entity into its React-Query cache with `setQueryData` (no refetch). Authorization moves from a per-event `Repository.Get` to a **connect-time accessible-repo set** (cached), so the streaming session makes no per-event API calls either. Pull-request *metadata* is pushed the same way; the aggregated PR **check status** (which isn't in any single webhook) is refreshed by a **debounced, per-PR** fetch only when check events arrive.

**Tech Stack:** .NET 10 minimal API, Octokit.Webhooks, `System.Threading.Channels` (existing `EventBroadcaster`), React + TanStack Query.

## Global Constraints

- **No GitHub API call in the live event path.** Mapping a webhook to a model must use only the webhook payload. The only permitted fetches are: (a) the connect-time accessible-repo set (once per connect, cached), and (b) the debounced PR check-status refresh (one fetch per PR per burst, check events only).
- **Authorization is server-side and fails closed.** A user only receives an event for a repo their token can access. Never trust client-supplied repo lists. An unauthenticated stream connection gets nothing (401).
- **Respect the dashboard branch filter.** The `getWorkflows` cache is keyed by `["getWorkflows", selectedRepositories, branchFilter]`. A pushed run whose `headBranch` doesn't match that query's branch filter must not be merged into it.
- **Only update what's already cached.** `setQueryData` updates existing repos/workflows/PRs in the cache; events for repos/workflows/PRs the client isn't showing are ignored (no insertion of unrelated repos).
- **The SSE payload is a hand-written contract** (`GitHubEvent` record in `Models/`, `GitHubEvent` interface in `useGitHubEventStream.ts`) — there is no OpenAPI/generated-client involvement. Keep the two in sync by hand.
- **Supersedes PR #214** (per-event `RepositoryAccessService`). This plan replaces that authorization approach; `RepositoryAccessService` is removed. Close #214 when this merges.
- Do NOT stage `src/Wrangler.App/src/routeTree.gen.ts`, `package.json`/`package-lock.json`, or `openapi-v1.json` (unrelated local churn).

---

## File Structure

**Backend — `src/Wrangler.Api/`:**
- `Models/GitHubEvent.cs` — enrich: carry an optional `WorkflowRunModel Run` and optional PR-metadata object, alongside the existing routing fields.
- `Webhooks/GitHubWebhookEventProcessor.cs` — map the webhook payload to the model in `Broadcast(...)` (no API call).
- `Webhooks/WebhookMapping.cs` (new) — pure mappers: webhook `WorkflowRun` → `WorkflowRunModel`; webhook `PullRequest` → PR metadata. Unit-tested.
- `Services/SubscriberAuthorizationService.cs` (new) → `ISubscriberAuthorization` — resolves the current user's accessible `owner/repo` set once, cached; `CanAccess(owner, repo)` is an in-memory set lookup.
- `Endpoints/EventStreamHandler.cs` — resolve the accessible set at connect, filter events against it in-memory (replaces the per-event `IRepositoryAccessService` call).
- Delete `Services/RepositoryAccessService.cs` (superseded).

**Frontend — `src/Wrangler.App/src/`:**
- `hooks/useGitHubEventStream.ts` — switch from `invalidateQueries` to `setQueryData` merges; add the debounced PR check-status refetch.
- `hooks/mergeWorkflowRun.ts` (new) — pure function: splice a pushed run into `RepositoryModel[]`, respecting branch filter, recomputing statuses. Unit-tested.
- `hooks/mergePullRequest.ts` (new) — pure function: merge pushed PR metadata into the cached PR list. Unit-tested.

---

### Task 1: Pure webhook→model mappers (backend)

Extract the payload→model mapping as pure, unit-testable functions. All fields come from the webhook; no API call.

**Files:**
- Create: `src/Wrangler.Api/Webhooks/WebhookMapping.cs`
- Create: `tests/Wrangler.Tests/WebhookMappingTests.cs`

**Interfaces:**
- Produces: `WebhookMapping.ToRunModel(Octokit.Webhooks.Models.WorkflowRun run) : WorkflowRunModel`; `WebhookMapping.ToPullRequestMetadata(Octokit.Webhooks.Models...PullRequest pr, string owner, string repo) : PullRequestEventData`.

- [ ] **Step 1: Write the failing test for the run mapper**

Create `tests/Wrangler.Tests/WebhookMappingTests.cs`. Build an uninitialised `WorkflowRunCompletedEvent`'s `WorkflowRun` (models have no public ctor — use `RuntimeHelpers.GetUninitializedObject` and set properties, as in `WebhookProcessingResilienceTests`), set `Id/WorkflowId/NodeId/HeadBranch/Event/RunNumber/Status/Conclusion/CreatedAt/UpdatedAt/HtmlUrl`, and assert `WebhookMapping.ToRunModel(run)` copies each field and that `WorkflowStatus` derives correctly (e.g. `Conclusion="failure"` → `WorkflowStatus.Red`).

```csharp
// Field carry + derived status. StringEnum values map by their string value.
var run = /* uninitialised WorkflowRun with the fields above, Conclusion "failure", Status "completed" */;
var model = WebhookMapping.ToRunModel(run);
Assert.Equal(run.Id, model.Id);
Assert.Equal("failure", model.Conclusion!.Value.ToString().ToLowerInvariant());
Assert.Equal(Asm.Wrangler.Api.Models.WorkflowStatus.Red, model.WorkflowStatus);
```

- [ ] **Step 2: Run it to see it fail** — `dotnet test --filter WebhookMappingTests` → FAIL (type doesn't exist).

- [ ] **Step 3: Implement `WebhookMapping`**

Create `src/Wrangler.Api/Webhooks/WebhookMapping.cs`. Map the webhook `WorkflowRun` to `WorkflowRunModel`. The webhook `Conclusion`/`Status` are `Octokit.Webhooks` `StringEnum`s; carry them into the model's `Octokit.StringEnum<WorkflowRunConclusion>`/`<WorkflowRunStatus>` by their string value:

```csharp
using Asm.Wrangler.Api.Models.Dashboard;
using Octokit;
using WWorkflowRun = Octokit.Webhooks.Models.WorkflowRun;

namespace Asm.Wrangler.Api.Webhooks;

public static class WebhookMapping
{
    public static WorkflowRunModel ToRunModel(WWorkflowRun run) => new()
    {
        Id = run.Id,
        WorkflowId = run.WorkflowId,
        NodeId = run.NodeId,
        // Octokit StringEnum is string-backed; carry the webhook's string value across.
        Conclusion = run.Conclusion is null ? null : new StringEnum<WorkflowRunConclusion>(run.Conclusion.Value.ToString()),
        Status = new StringEnum<WorkflowRunStatus>(run.Status.ToString()),
        HeadBranch = run.HeadBranch,
        Event = run.Event,
        RunNumber = run.RunNumber,
        TriggeringActor = run.TriggeringActor?.Name ?? run.TriggeringActor?.Login,
        CreatedAt = run.CreatedAt,
        UpdatedAt = run.UpdatedAt,
        HtmlUrl = run.HtmlUrl,
    };
}
```

Confirm against the real API that `StringEnum<T>` has a `(string)` constructor and that `run.Conclusion.Value.ToString()` yields the GitHub token (e.g. `"failure"`); adjust the accessor if the reflected shape differs (the implementer must verify the exact `StringEnum` surface for this Octokit.Webhooks version).

- [ ] **Step 4: Run the test** → PASS.

- [ ] **Step 5: Add the PR-metadata mapper + test**

Define `public record PullRequestEventData(long Id, int Number, string NodeId, string Title, string Author, string RepositoryOwner, string RepositoryName, string HtmlUrl, string HeadSha, string HeadRef, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, string State)` and `ToPullRequestMetadata(pr, owner, repo)` copying from the webhook PR (`pr.User.Login` → Author, `pr.Head.Sha`/`pr.Head.Ref`, `pr.State.ToString()`). Add a test asserting the carry. (Check status is intentionally absent — it isn't in the payload.)

- [ ] **Step 6: Commit**

```bash
git add src/Wrangler.Api/Webhooks/WebhookMapping.cs tests/Wrangler.Tests/WebhookMappingTests.cs
git commit -m "Add pure webhook payload to model mappers"
```

---

### Task 2: Enrich the broadcast event and populate it in the processor

**Files:**
- Modify: `src/Wrangler.Api/Models/GitHubEvent.cs`
- Modify: `src/Wrangler.Api/Webhooks/GitHubWebhookEventProcessor.cs`

**Interfaces:**
- Consumes: `WebhookMapping` (Task 1).
- Produces: `GitHubEvent.Run` (`WorkflowRunModel?`) and `GitHubEvent.PullRequest` (`PullRequestEventData?`) populated on the broadcast.

- [ ] **Step 1: Extend `GitHubEvent`**

Add to the record: `public WorkflowRunModel? Run { get; init; }` and `public PullRequestEventData? PullRequest { get; init; }`. Keep the existing `Type/Owner/Repo/WorkflowId/RunId/PullRequestNumber/DeliveryId` (still used for routing and for check_run/check_suite which carry no pushable entity). Add the needed `using`.

- [ ] **Step 2: Populate in the processor**

In `ProcessWorkflowRunWebhookAsync`, pass the mapped run into the broadcast. Change `Broadcast(...)` (or add an overload) so the workflow_run path sets `Run = WebhookMapping.ToRunModel(workflowRunEvent.WorkflowRun)`. In `ProcessPullRequestWebhookAsync`, set `PullRequest = WebhookMapping.ToPullRequestMetadata(pullRequestEvent.PullRequest, owner, repo)`. `check_run`/`check_suite` broadcasts stay metadata-only (no pushable entity). No API calls added.

- [ ] **Step 3: Build** — `cd src/Wrangler.Api && dotnet build` → succeeds.

- [ ] **Step 4: Extend the resilience test payload isn't required**, but run the suite — `cd tests/Wrangler.Tests && dotnet test` → all pass (existing webhook-resilience tests still build the event; the new nullable fields default to null).

- [ ] **Step 5: Commit**

```bash
git add src/Wrangler.Api/Models/GitHubEvent.cs src/Wrangler.Api/Webhooks/GitHubWebhookEventProcessor.cs
git commit -m "Carry the mapped run and PR metadata in the broadcast event"
```

---

### Task 3: Connect-time accessible-repo set authorization (replaces per-event check)

**Files:**
- Create: `src/Wrangler.Api/Services/SubscriberAuthorizationService.cs`
- Create: `tests/Wrangler.Tests/SubscriberAuthorizationServiceTests.cs`
- Modify: `src/Wrangler.Api/Endpoints/EventStreamHandler.cs`
- Modify: `src/Wrangler.Api/Program.cs` (register the new service; remove the `IRepositoryAccessService` registration)
- Delete: `src/Wrangler.Api/Services/RepositoryAccessService.cs` and `tests/Wrangler.Tests/RepositoryAccessServiceTests.cs`

**Interfaces:**
- Produces: `ISubscriberAuthorization.GetAccessibleAsync(CancellationToken) : Task<IReadOnlySet<string>>` returning a set of `"owner/repo"` (lower-cased), resolved once from the user's token and cached per user (`ICacheKeyService`) for ~5 minutes.

- [ ] **Step 1: Implement the service**

Resolve the user's repos the same way `RepositoriesHandler` does (orgs → `Repository.GetAllForOrg`, plus `Repository.GetAllForCurrent`), project to `"{owner}/{repo}".ToLowerInvariant()`, and cache the serialized set via `IDistributedCache` + `ICacheKeyService` (key `subscriber-repos`) with a 5-minute TTL. Return an empty set on failure (fail closed). Reuse the `GitHubService` `OctoCall` retry via inheritance or inline.

- [ ] **Step 2: Filter at connect in `EventStreamHandler`**

Replace the `IRepositoryAccessService` parameter with `ISubscriberAuthorization`. Before the loop, `var accessible = await authorization.GetAccessibleAsync(cancellationToken);`. In the read loop, before writing an event: `if (!accessible.Contains($"{evt.Owner}/{evt.Repo}".ToLowerInvariant())) continue;`. (Resolving `ISubscriberAuthorization` still forces `IGitHubClient` resolution, so anonymous connections still 401.) Keep the buffering/heartbeat code unchanged.

- [ ] **Step 3: Program.cs** — `AddScoped<ISubscriberAuthorization, SubscriberAuthorizationService>()`; remove the `IRepositoryAccessService` line.

- [ ] **Step 4: Delete the superseded service + its tests** — `git rm src/Wrangler.Api/Services/RepositoryAccessService.cs tests/Wrangler.Tests/RepositoryAccessServiceTests.cs`.

- [ ] **Step 5: Test the set resolution + caching**

`SubscriberAuthorizationServiceTests`: using a real `GitHubClient` over a stub handler (as in the deleted `RepositoryAccessServiceTests`) returning org/repo lists, assert the set contains the expected `owner/repo` entries and that a second call is served from the fake cache without new HTTP calls.

- [ ] **Step 6: Build, test, commit**

```bash
cd src/Wrangler.Api && dotnet build && cd ../../tests/Wrangler.Tests && dotnet test
git add -A src/Wrangler.Api/Services src/Wrangler.Api/Endpoints/EventStreamHandler.cs src/Wrangler.Api/Program.cs tests/Wrangler.Tests
git commit -m "Authorize SSE subscribers with a cached connect-time accessible-repo set"
```

---

### Task 4: Frontend — merge pushed workflow runs (no refetch)

**Files:**
- Create: `src/Wrangler.App/src/hooks/mergeWorkflowRun.ts`
- Create: `src/Wrangler.App/src/hooks/mergeWorkflowRun.test.ts`

**Interfaces:**
- Produces: `mergeWorkflowRun(repositories: RepositoryModel[], owner: string, repo: string, run: WorkflowRunModel, branchFilter: string[]) : RepositoryModel[]` — pure; returns a new array with the run spliced in, or the input unchanged when it shouldn't apply.

- [ ] **Step 1: Write failing tests**

`mergeWorkflowRun.test.ts` covering: (a) run for a cached repo+workflow whose branch matches → replaces that workflow's latest run and recomputes `overallStatus`; (b) run whose `headBranch` doesn't match `branchFilter` → input returned unchanged; (c) run for an owner/repo not in the list → unchanged; (d) run for a repo present but workflow id not present → unchanged. Reuse the branch-match helper semantics from `useWorkflows.ts` (`branchMatch`).

- [ ] **Step 2: Implement `mergeWorkflowRun`**

Find the repo (`owner`/`name` match, case-insensitive), find the workflow (`id === run.workflowId`); if the run's `headBranch` fails `branchMatch(run.headBranch, branchFilter)` return the input unchanged. Replace that workflow's `runs` with `[run]` (the dashboard shows the latest run per workflow), recompute the workflow `overallStatus` = worst of its runs' `workflowStatus`, and the repo `overallStatus` = worst across its workflows. Extract `branchMatch` and the status-priority helper into a shared module or duplicate minimally with a comment. Return a new array (immutable update).

- [ ] **Step 3: Run tests** → PASS. Commit.

```bash
git add src/Wrangler.App/src/hooks/mergeWorkflowRun.ts src/Wrangler.App/src/hooks/mergeWorkflowRun.test.ts
git commit -m "Add pure merge for a pushed workflow run into the dashboard cache"
```

---

### Task 5: Frontend — wire the stream to setQueryData (workflows) + PR handling

**Files:**
- Modify: `src/Wrangler.App/src/hooks/useGitHubEventStream.ts`
- Create: `src/Wrangler.App/src/hooks/mergePullRequest.ts` (+ test)

**Interfaces:**
- Consumes: `mergeWorkflowRun` (Task 4); the enriched `GitHubEvent` (adds `run?: WorkflowRunModel`, `pullRequest?: {...}`).

- [ ] **Step 1: Update the `GitHubEvent` interface** in `useGitHubEventStream.ts` to add `run?: WorkflowRunModel` and `pullRequest?: { id; number; nodeId; title; author; repositoryOwner; repositoryName; htmlUrl; headSha; headRef; createdAt; updatedAt; state }`, matching the backend record casing (camelCase over the wire).

- [ ] **Step 2: workflow_run → setQueryData**

On a `workflow_run` event with `evt.run`, update every matching dashboard cache without refetching:

```ts
queryClient.setQueriesData<RepositoryModel[]>({ queryKey: ["getWorkflows"] }, (data, query) => {
  if (!data || !evt.run) return data;
  const branchFilter = (query.queryKey[2] as string[] | undefined) ?? [];
  return mergeWorkflowRun(data, evt.owner, evt.repo, evt.run, branchFilter);
});
```

(`setQueriesData`'s updater receives the query, so each cached branch-filter variant is merged correctly.) Also update the drill-down `["getWorkflowRuns", owner, repo]` cache if present (prepend the run).

- [ ] **Step 3: pull_request → setQueryData metadata; check_* → debounced check-status refetch**

For `pull_request` events with `evt.pullRequest`, `setQueryData(["pullRequests"], mergePullRequest(...))` (update matching PR fields; leave `checkStatus` as-is). For `check_run`/`check_suite` events (which can't carry the aggregate check status), schedule a **debounced** invalidation of `["pullRequests"]` keyed by `owner/repo` (e.g. 2s trailing debounce) so a burst of check events collapses to a single refetch. `mergePullRequest` is a pure function (create + test): match by `id`/`number`+repo, update metadata fields, keep `checkStatus`; ignore PRs not already cached.

- [ ] **Step 4: Confirm the PR query key** by reading the PR list hook; use whatever key it registers (the plan assumes `["pullRequests"]`). Fix the keys if they differ.

- [ ] **Step 5: Verify** — `cd src/Wrangler.App && npm test && npm run lint && npm run build` → all green.

- [ ] **Step 6: Commit**

```bash
git add src/Wrangler.App/src/hooks/
git commit -m "Update dashboard and PRs from the stream via setQueryData; debounce check-status refetch"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1:** `cd src/Wrangler.Api && dotnet build` and `cd tests/Wrangler.Tests && dotnet test` → all pass.
- [ ] **Step 2:** `cd src/Wrangler.App && npm test && npm run lint && npm run build` → all green.
- [ ] **Step 3:** Confirm no per-event GitHub call remains in the stream path: `EventStreamHandler` resolves the accessible set once (Task 3) and the loop only does set lookups + `setQueryData`; the only fetches are connect-time set resolution and the debounced PR check-status refetch. Grep the event loop for any `Repository.Get`/service call — there should be none.
- [ ] **Step 4:** Manual sanity (documented, not automated): a `workflow_run` event updates the dashboard card's run status without a network request to `/api/workflows` (check DevTools Network); heartbeats still arrive.

---

## Self-Review Notes

- **Spec coverage:** push workflows (Tasks 1,2,4,5) ✓; push PR metadata + debounced check status (Tasks 1,2,5) ✓; connect-time authz replacing per-event (Task 3) ✓; supersede #214 (Task 3 deletes `RepositoryAccessService`) ✓.
- **The check-status honesty:** the aggregated PR check status genuinely isn't in a single webhook, so Task 5 debounces a per-PR refetch for check events rather than pretending to push it — a bounded, coalesced fetch, not per-event.
- **Type consistency:** `mergeWorkflowRun` signature (Task 4) matches its call in Task 5; `GitHubEvent.Run`/`.PullRequest` (Task 2) match the frontend interface fields (Task 5 Step 1).
- **Verify-before-coding flags for implementers:** the exact `Octokit.Webhooks` `StringEnum` accessor (Task 1 Step 3) and the real PR list query key (Task 5 Step 4).
