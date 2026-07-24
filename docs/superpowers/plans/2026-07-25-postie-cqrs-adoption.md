# Postie CQRS Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the Postie CQRS library across the convertible `/api` data endpoints in `Wrangler.Api`, replacing the static `*Handler.Handle` adapters and the manual `api.Map*` block with `MapQuery`/`MapCommand` conventions, while preserving every wire contract so the generated frontend client regenerates to an empty diff.

**Architecture:** Request records gain a Postie `IQuery`/`ICommand` marker interface (names unchanged, so OpenAPI component names are unchanged). Each gets one thin `IQueryHandler`/`ICommandHandler` whose body is the current static handler's body minus the `TypedResults`/`Ok<>` wrapping (Postie wraps the result). The existing `I*Service` layer and `GitHubService` base are untouched. Endpoints map through `MapQuery`/`MapCommand`; the Postie mediator (`Postie.Cqrs.AspNetCore`) dispatches.

**Tech Stack:** .NET 10, ASP.NET Core Minimal API, `Postie.Cqrs.AspNetCore` v1.0.1, `Microsoft.Extensions.ApiDescription.Server` (build-time OpenAPI), hey-api (`@hey-api/openapi-ts`) frontend client generation.

## Global Constraints

- **Primary invariant — no breaking frontend-client change.** After every slice: `dotnet build` (regenerates `src/Wrangler.Api/openapi-v1.json`) → `npm run generate` in `src/Wrangler.App` → inspect `git diff --ignore-all-space src/Wrangler.App/src/api/`. The **only** permitted semantic change is *additive*: new `Get*Errors`/`Post*Errors` types of shape `{ 404: unknown }` and the matching error-type-param change (`unknown` → the new `*Errors` type) on the converted endpoint's function/hook. **No** renamed or removed functions/hooks/types, **no** changed request- or response-body types, **no** changed parameters. Then commit the regenerated `src/api/` with the task. (Context: the committed client was stale vs the pinned `openapi-ts 0.99.0` formatting; a one-time reformat landed in commit `b940cf4`, so per-task client diffs are now small and additive-only. A *literally* empty `git diff src/api/` is not achievable in this repo and is not the gate.)
- **Frontend must stay green:** after regenerating, `cd src/Wrangler.App && npm run build && npm test && npm run lint` all pass (the build's `tsc -b` is what proves the additive error types don't break existing call sites).
- **The only permitted OpenAPI change** is an *additive* `404` response on reference-returning query endpoints (Postie advertises null→404; our queries return empty collections, never null, so runtime behaviour is unchanged) plus a `tags` value change (Postie tags converted endpoints `Asm.Wrangler.Api` instead of the deleted handler class name — cosmetic, does not affect the flat generated client). No path, verb, request-schema, response-schema, or `operationId`/route-name change is permitted.
- **Preserve routes and verbs exactly.** The `/api` group prefix (`app.MapGroup("/api")`) and the `/api`-strip OpenAPI document transformer stay.
- **Preserve `DisableAntiforgery()`** on the four body-POST *query* endpoints (`workflows`, `pull-requests`, `attention`, `gates`). The two `/approve` *command* endpoints do **not** disable antiforgery today — do not add it.
- **Request record names are unchanged.** Only add a marker interface. This keeps schema component `$ref` names stable.
- **Do NOT hand-edit `src/Wrangler.App/src/api/`** — it is generated. `routeTree.gen.ts` churn from the user's dev server is not ours; never stage it.
- **Kept raw minimal API (NOT converted) — do not touch their handlers or mappings:** `GET me` (returns 200/401 via a `Results<Ok, Unauthorized>` union — `MapQuery` forces 200/404 and would change the contract); `POST repositories/{owner}/{repo}/workflows/` and `POST repositories/{owner}/{repo}/workflows/{workflowId}/runs` (hybrid route+body whose body-wrapper schema and the sole explicit `operationId` "Get Workflows for a Repository" must be preserved exactly — the spec's authorised fallback). Also untouched as before: `callback/github`, `login/github`, `logout`, `events/stream`, `admin/session/debug`, webhooks.

---

## File Structure

**Backend — `src/Wrangler.Api/`:**
- `Wrangler.Api.csproj` — add one `PackageReference`.
- `Program.cs` — add `AddPostie(...)` in `AddServices`; replace the nine convertible `api.Map*` lines in `AddApp`.
- `Requests/*.cs` — add marker interface to nine request records; add three new request records (`RepositoriesRequest`, `GroupedRepositoriesRequest`, `UserSearchRequest`).
- `Handlers/` — add nine CQRS handler classes (`*QueryHandler`/`*CommandHandler`); delete the nine replaced static handlers. Keep `MeHandler`, `RepositoriesWorkflowsHandler`, `WorkflowRunsHandler`, and the non-CQRS handlers.

**Tests — `tests/Wrangler.Tests/`:**
- `Cqrs/HandlerRegistrationTests.cs` (new) — reflection smoke test: every `IQuery`/`ICommand` request type in the API assembly has exactly one matching handler class.

**Handler → service mapping (reference for all tasks):**

| Request record | Handler class (new) | Marker interface | Service call in `Handle` |
|---|---|---|---|
| `WorkflowsRequest` | `WorkflowsQueryHandler` | `IQuery<IEnumerable<RepositoryModel>>` | `IDashboardService.GetWorkflowsAsync(query, ct)` |
| `PullRequestsRequest` | `PullRequestsQueryHandler` | `IQuery<IEnumerable<PullRequestModel>>` | `IPullRequestService.GetPullRequestsAsync(query, ct)` |
| `AttentionRequest` | `AttentionQueryHandler` | `IQuery<IEnumerable<AttentionItem>>` | `IAttentionService.GetAttentionItemsAsync(query, ct)` |
| `GatesRequest` | `GatesQueryHandler` | `IQuery<IEnumerable<DeploymentGateModel>>` | `IGateService.GetGatesAsync(query, ct)` |
| `ApprovePullRequestsRequest` | `ApprovePullRequestsCommandHandler` | `ICommand<IEnumerable<ApprovalResult>>` | `IPullRequestService.ApprovePullRequestsAsync(command, ct)` |
| `ApproveGatesRequest` | `ApproveGatesCommandHandler` | `ICommand<IEnumerable<GateApprovalResult>>` | `IGateService.ApproveGatesAsync(command, ct)` |
| `RepositoriesRequest` (new, empty) | `RepositoriesQueryHandler` | `IQuery<IEnumerable<Repository>>` | inline `IGitHubClient` org iteration (see Task 5) |
| `GroupedRepositoriesRequest` (new, empty) | `GroupedRepositoriesQueryHandler` | `IQuery<IEnumerable<AccountModel>>` | `ISettingsService.ListAllWorkflowsAsync(ct)` |
| `UserSearchRequest` (new) | `UserSearchQueryHandler` | `IQuery<IEnumerable<UserSearchResult>>` | `IUserSearchService.SearchUsersAsync(query.Q ?? "", ct)` |

---

### Task 1: Add Postie dependency and mediator wiring

Adds the package and registers the mediator without mapping any endpoint yet. Nothing dispatches through Postie, so the OpenAPI document is unchanged — this slice proves the dependency and DI resolve cleanly.

**Files:**
- Modify: `src/Wrangler.Api/Wrangler.Api.csproj`
- Modify: `src/Wrangler.Api/Program.cs:71-83` (the `AddScoped`/`AddSingleton` service block in `AddServices`)

**Interfaces:**
- Consumes: nothing.
- Produces: `AddPostie(...)` registered in DI; `MapQuery`/`MapCommand` extension methods (namespace `Postie.AspNetCore`) available in `Program.cs` for later tasks.

- [ ] **Step 1: Add the package reference**

In `src/Wrangler.Api/Wrangler.Api.csproj`, inside the existing `<ItemGroup>` that holds `<PackageReference>` items, add:

```xml
<PackageReference Include="Postie.Cqrs.AspNetCore" Version="1.0.1" />
```

- [ ] **Step 2: Register the Postie mediator**

In `src/Wrangler.Api/Program.cs`, in `AddServices`, immediately after the line `builder.Services.AddScoped<IUserSearchService, UserSearchService>();` (currently line 77), add:

```csharp
// Postie CQRS: scans this assembly for IQueryHandler/ICommandHandler implementations
// and wires the endpoint dispatcher used by MapQuery/MapCommand.
builder.Services.AddPostie(typeof(Requests.WorkflowsRequest).Assembly);
```

`AddPostie` lives in the `Microsoft.Extensions.DependencyInjection` namespace, which minimal API `Program.cs` files already have in global scope, so it needs no using. Add `using Postie.AspNetCore;` to the top of `Program.cs` now — it is needed for `QueryMethod`, `MapQuery`, and `MapCommand` in later tasks. (`typeof(Requests.WorkflowsRequest)` uses the fully-qualified `Requests.` prefix, so no `Asm.Wrangler.Api.Requests` using is required for this line.)

- [ ] **Step 3: Build the backend**

Run: `cd src/Wrangler.Api && dotnet build`
Expected: build succeeds. (Zero handlers exist yet; `AddPostie` scanning an assembly with no handlers is valid.)

- [ ] **Step 4: Verify the OpenAPI document is unchanged**

Run: `git diff src/Wrangler.Api/openapi-v1.json`
Expected: **empty** (no endpoint was mapped through Postie).

- [ ] **Step 5: Commit**

```bash
git add src/Wrangler.Api/Wrangler.Api.csproj src/Wrangler.Api/Program.cs
git commit -m "Add Postie CQRS package and register the mediator"
```

---

### Task 2: Convert `POST workflows` (pattern-establishing slice)

Converts one body-POST query end to end, proving the full pattern including the frontend-client gate. Later tasks replicate it.

**Files:**
- Modify: `src/Wrangler.Api/Requests/WorkflowsRequest.cs`
- Create: `src/Wrangler.Api/Handlers/WorkflowsQueryHandler.cs`
- Delete: `src/Wrangler.Api/Handlers/WorkflowsHandler.cs`
- Modify: `src/Wrangler.Api/Program.cs:264` (the `api.MapPost("workflows", ...)` line)

**Interfaces:**
- Consumes: `AddPostie` wiring from Task 1; `IDashboardService.GetWorkflowsAsync(WorkflowsRequest, CancellationToken) : Task<IEnumerable<RepositoryModel>>`.
- Produces: `WorkflowsRequest : IQuery<IEnumerable<RepositoryModel>>`; `WorkflowsQueryHandler`. Establishes the conversion pattern reused by Tasks 3–5.

- [ ] **Step 1: Add the marker interface to the request**

In `src/Wrangler.Api/Requests/WorkflowsRequest.cs`, change the declaration and add the using:

```csharp
using Asm.Wrangler.Api.Models.Dashboard;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Requests;

/// <summary>
/// Request to retrieve workflows and their latest runs for the specified repositories.
/// </summary>
public record WorkflowsRequest : BranchFilterRequest, IQuery<IEnumerable<RepositoryModel>>
{
```

(Leave the rest of the record body — `RepositoryWorkflowRequest` and `Repositories` — exactly as-is.)

- [ ] **Step 2: Create the query handler**

Create `src/Wrangler.Api/Handlers/WorkflowsQueryHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Gets a list of workflows and their latest runs for the specified repositories.
/// </summary>
public class WorkflowsQueryHandler(IDashboardService gitHubService)
    : IQueryHandler<WorkflowsRequest, IEnumerable<RepositoryModel>>
{
    public ValueTask<IEnumerable<RepositoryModel>> Handle(WorkflowsRequest query, CancellationToken cancellationToken) =>
        new(gitHubService.GetWorkflowsAsync(query, cancellationToken));
}
```

- [ ] **Step 3: Delete the old static handler**

```bash
git rm src/Wrangler.Api/Handlers/WorkflowsHandler.cs
```

- [ ] **Step 4: Replace the endpoint mapping**

In `src/Wrangler.Api/Program.cs`, replace this line (currently line 264):

```csharp
    api.MapPost("workflows", WorkflowsHandler.Handle).DisableAntiforgery();
```

with:

```csharp
    api.MapQuery<WorkflowsRequest, IEnumerable<RepositoryModel>>("workflows", QueryMethod.Post).DisableAntiforgery();
```

(`QueryMethod` resolves via the `using Postie.AspNetCore;` added in Task 1. `RepositoryModel` resolves via the existing `using Asm.Wrangler.Api.Models.Dashboard;` at the top of `Program.cs`.)

- [ ] **Step 5: Build and inspect the OpenAPI diff**

Run: `cd src/Wrangler.Api && dotnet build`
Then: `git diff src/Wrangler.Api/openapi-v1.json`
Expected: build succeeds; the **only** diff for the `/workflows` path is an added `"404"` response entry. No change to the path, the `post` verb, the `WorkflowsRequest` request body schema, or the `200` response schema.

- [ ] **Step 6: Regenerate the frontend client and verify it is empty**

Run: `cd src/Wrangler.App && npm run generate`
Then: `git diff src/Wrangler.App/src/api/`
Expected: **empty**. If it is not empty, the mapping changed the contract — stop and reconcile before committing.

- [ ] **Step 7: Commit**

```bash
git add src/Wrangler.Api/Requests/WorkflowsRequest.cs src/Wrangler.Api/Handlers/WorkflowsQueryHandler.cs src/Wrangler.Api/Program.cs src/Wrangler.Api/openapi-v1.json
git commit -m "Convert workflows endpoint to Postie MapQuery"
```

---

### Task 3: Convert the remaining three body-POST queries

Applies the Task 2 pattern to `pull-requests`, `attention`, and `gates`. All three are pure service delegations, identical in shape to `workflows`.

**Files:**
- Modify: `src/Wrangler.Api/Requests/PullRequestsRequest.cs`, `AttentionRequest.cs`, `GatesRequest.cs`
- Create: `src/Wrangler.Api/Handlers/PullRequestsQueryHandler.cs`, `AttentionQueryHandler.cs`, `GatesQueryHandler.cs`
- Delete: `src/Wrangler.Api/Handlers/PullRequestsHandler.cs`, `AttentionHandler.cs`, `GatesHandler.cs`
- Modify: `src/Wrangler.Api/Program.cs:273,276,277` (the three `api.MapPost(...)` lines)

**Interfaces:**
- Consumes: Task 2 pattern; `IPullRequestService.GetPullRequestsAsync`, `IAttentionService.GetAttentionItemsAsync`, `IGateService.GetGatesAsync`.
- Produces: `PullRequestsRequest`/`AttentionRequest`/`GatesRequest` implementing their `IQuery<>`; three query handlers.

- [ ] **Step 1: Add marker interfaces to the three requests**

`src/Wrangler.Api/Requests/PullRequestsRequest.cs` — add `using Asm.Wrangler.Api.Models.PullRequests;` and `using Postie.Cqrs.Queries;`, then change:

```csharp
public record PullRequestsRequest : IQuery<IEnumerable<PullRequestModel>>
```

`src/Wrangler.Api/Requests/AttentionRequest.cs` — add `using Asm.Wrangler.Api.Models.Attention;` and `using Postie.Cqrs.Queries;`, then change:

```csharp
public record AttentionRequest : IQuery<IEnumerable<AttentionItem>>
```

`src/Wrangler.Api/Requests/GatesRequest.cs` — add `using Asm.Wrangler.Api.Models.Gates;` and `using Postie.Cqrs.Queries;`, then change:

```csharp
public record GatesRequest : IQuery<IEnumerable<DeploymentGateModel>>
```

(Leave each record's nested `RepositoryRequest` and `Repositories`/`Authors` members unchanged.)

- [ ] **Step 2: Create the three query handlers**

Create `src/Wrangler.Api/Handlers/PullRequestsQueryHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Retrieves open pull requests matching the specified repositories and author filters.</summary>
public class PullRequestsQueryHandler(IPullRequestService service)
    : IQueryHandler<PullRequestsRequest, IEnumerable<PullRequestModel>>
{
    public ValueTask<IEnumerable<PullRequestModel>> Handle(PullRequestsRequest query, CancellationToken cancellationToken) =>
        new(service.GetPullRequestsAsync(query, cancellationToken));
}
```

Create `src/Wrangler.Api/Handlers/AttentionQueryHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.Attention;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Returns the unified attention feed across the requested repositories.</summary>
public class AttentionQueryHandler(IAttentionService service)
    : IQueryHandler<AttentionRequest, IEnumerable<AttentionItem>>
{
    public ValueTask<IEnumerable<AttentionItem>> Handle(AttentionRequest query, CancellationToken cancellationToken) =>
        new(service.GetAttentionItemsAsync(query, cancellationToken));
}
```

Create `src/Wrangler.Api/Handlers/GatesQueryHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Lists pending deployment gates across the requested repositories.</summary>
public class GatesQueryHandler(IGateService service)
    : IQueryHandler<GatesRequest, IEnumerable<DeploymentGateModel>>
{
    public ValueTask<IEnumerable<DeploymentGateModel>> Handle(GatesRequest query, CancellationToken cancellationToken) =>
        new(service.GetGatesAsync(query, cancellationToken));
}
```

- [ ] **Step 3: Delete the three old static handlers**

```bash
git rm src/Wrangler.Api/Handlers/PullRequestsHandler.cs src/Wrangler.Api/Handlers/AttentionHandler.cs src/Wrangler.Api/Handlers/GatesHandler.cs
```

- [ ] **Step 4: Replace the three endpoint mappings**

In `src/Wrangler.Api/Program.cs`, replace:

```csharp
    api.MapPost("pull-requests", PullRequestsHandler.Handle).DisableAntiforgery();
```
with:
```csharp
    api.MapQuery<PullRequestsRequest, IEnumerable<PullRequestModel>>("pull-requests", QueryMethod.Post).DisableAntiforgery();
```

Replace:
```csharp
    api.MapPost("attention", AttentionHandler.Handle).DisableAntiforgery();
```
with:
```csharp
    api.MapQuery<AttentionRequest, IEnumerable<AttentionItem>>("attention", QueryMethod.Post).DisableAntiforgery();
```

Replace:
```csharp
    api.MapPost("gates", GatesHandler.Handle).DisableAntiforgery();
```
with:
```csharp
    api.MapQuery<GatesRequest, IEnumerable<DeploymentGateModel>>("gates", QueryMethod.Post).DisableAntiforgery();
```

Add the model usings at the top of `Program.cs` if not already present: `using Asm.Wrangler.Api.Models.PullRequests;`, `using Asm.Wrangler.Api.Models.Attention;`, `using Asm.Wrangler.Api.Models.Gates;`. (`Models.Dashboard` is already imported.)

- [ ] **Step 5: Build and inspect the OpenAPI diff**

Run: `cd src/Wrangler.Api && dotnet build`
Then: `git diff src/Wrangler.Api/openapi-v1.json`
Expected: build succeeds; the only diffs are added `"404"` responses on `/pull-requests`, `/attention`, `/gates`. No path/verb/schema changes.

- [ ] **Step 6: Regenerate the frontend client and verify additive-only**

Run: `cd src/Wrangler.App && npm run generate`
Then: `git diff --ignore-all-space src/Wrangler.App/src/api/`
Expected: only *additive* changes — new `PostPullRequestsErrors`, `PostAttentionErrors`, `PostGatesErrors` (`{ 404: unknown }`) types and the matching error-param change on `postPullRequests`/`postAttention`/`postGates`. No renamed/removed functions/hooks/types, no request/response-body-type change.
Then: `npm run build && npm test && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit (including the regenerated client)**

```bash
git add src/Wrangler.Api/Requests/ src/Wrangler.Api/Handlers/ src/Wrangler.Api/Program.cs src/Wrangler.Api/openapi-v1.json src/Wrangler.App/src/api/
git commit -m "Convert pull-requests, attention, and gates endpoints to Postie MapQuery"
```

(Do NOT stage `src/Wrangler.App/src/routeTree.gen.ts`.)

---

### Task 4: Convert the two approve commands

`pull-requests/approve` and `gates/approve` mutate, so they map with `MapCommand<TRequest, TResponse>` (POST, 200 OK with body). Antiforgery stays enforced (do not add `DisableAntiforgery()`).

**Files:**
- Modify: `src/Wrangler.Api/Requests/ApprovePullRequestsRequest.cs`, `ApproveGatesRequest.cs`
- Create: `src/Wrangler.Api/Handlers/ApprovePullRequestsCommandHandler.cs`, `ApproveGatesCommandHandler.cs`
- Delete: `src/Wrangler.Api/Handlers/ApprovePullRequestsHandler.cs`, `ApproveGatesHandler.cs`
- Modify: `src/Wrangler.Api/Program.cs:274,278`

**Interfaces:**
- Consumes: `IPullRequestService.ApprovePullRequestsAsync(ApprovePullRequestsRequest, CancellationToken) : Task<IEnumerable<ApprovalResult>>`; `IGateService.ApproveGatesAsync(ApproveGatesRequest, CancellationToken) : Task<IEnumerable<GateApprovalResult>>`.
- Produces: `ApprovePullRequestsRequest : ICommand<IEnumerable<ApprovalResult>>`; `ApproveGatesRequest : ICommand<IEnumerable<GateApprovalResult>>`; two command handlers.

- [ ] **Step 1: Add command marker interfaces**

`src/Wrangler.Api/Requests/ApprovePullRequestsRequest.cs` — add `using Asm.Wrangler.Api.Models.PullRequests;` and `using Postie.Cqrs.Commands;`, then change:

```csharp
public record ApprovePullRequestsRequest : ICommand<IEnumerable<ApprovalResult>>
```

`src/Wrangler.Api/Requests/ApproveGatesRequest.cs` — add `using Asm.Wrangler.Api.Models.Gates;` and `using Postie.Cqrs.Commands;`, then change:

```csharp
public record ApproveGatesRequest : ICommand<IEnumerable<GateApprovalResult>>
```

(Leave `PullRequestReference`, `GateRef`, and the collection members unchanged. `GateRef` stays a top-level record as today.)

- [ ] **Step 2: Create the two command handlers**

Create `src/Wrangler.Api/Handlers/ApprovePullRequestsCommandHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Commands;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Approves and merges the specified pull requests.</summary>
public class ApprovePullRequestsCommandHandler(IPullRequestService service)
    : ICommandHandler<ApprovePullRequestsRequest, IEnumerable<ApprovalResult>>
{
    public ValueTask<IEnumerable<ApprovalResult>> Handle(ApprovePullRequestsRequest command, CancellationToken cancellationToken) =>
        new(service.ApprovePullRequestsAsync(command, cancellationToken));
}
```

Create `src/Wrangler.Api/Handlers/ApproveGatesCommandHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Commands;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Approves the specified deployment gates.</summary>
public class ApproveGatesCommandHandler(IGateService service)
    : ICommandHandler<ApproveGatesRequest, IEnumerable<GateApprovalResult>>
{
    public ValueTask<IEnumerable<GateApprovalResult>> Handle(ApproveGatesRequest command, CancellationToken cancellationToken) =>
        new(service.ApproveGatesAsync(command, cancellationToken));
}
```

- [ ] **Step 3: Delete the two old static handlers**

```bash
git rm src/Wrangler.Api/Handlers/ApprovePullRequestsHandler.cs src/Wrangler.Api/Handlers/ApproveGatesHandler.cs
```

- [ ] **Step 4: Replace the two endpoint mappings**

In `src/Wrangler.Api/Program.cs`, replace:

```csharp
    api.MapPost("pull-requests/approve", ApprovePullRequestsHandler.Handle);
```
with:
```csharp
    api.MapCommand<ApprovePullRequestsRequest, IEnumerable<ApprovalResult>>("pull-requests/approve");
```

Replace:
```csharp
    api.MapPost("gates/approve", ApproveGatesHandler.Handle);
```
with:
```csharp
    api.MapCommand<ApproveGatesRequest, IEnumerable<GateApprovalResult>>("gates/approve");
```

(`ApprovalResult` and `GateApprovalResult` resolve via the `Models.PullRequests`/`Models.Gates` usings added in Task 3.)

- [ ] **Step 5: Build and inspect the OpenAPI diff**

Run: `cd src/Wrangler.Api && dotnet build`
Then: `git diff src/Wrangler.Api/openapi-v1.json`
Expected: build succeeds. `MapCommand` advertises `200` with the response body (as today) and adds **no** `404`. The diff should be empty or cosmetically equivalent for `/pull-requests/approve` and `/gates/approve`. No path/verb/schema change.

- [ ] **Step 6: Regenerate the frontend client and verify additive-only**

Run: `cd src/Wrangler.App && npm run generate`
Then: `git diff --ignore-all-space src/Wrangler.App/src/api/`
Expected: **empty or no semantic change** — `MapCommand` advertises `200` with the response body and adds **no** `404`, so the approve functions' error param stays `unknown`. No renamed/removed functions/hooks/types, no request/response-body-type change. (If a spurious formatting-only diff appears, that is acceptable churn; there must be no semantic client change.)
Then: `npm run build && npm test && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit (including any regenerated client)**

```bash
git add src/Wrangler.Api/Requests/ src/Wrangler.Api/Handlers/ src/Wrangler.Api/Program.cs src/Wrangler.Api/openapi-v1.json src/Wrangler.App/src/api/
git commit -m "Convert approve endpoints to Postie MapCommand"
```

(Do NOT stage `src/Wrangler.App/src/routeTree.gen.ts`.)

---

### Task 5: Convert the three GET endpoints

`repositories`, `repositories/grouped`, and `users/search` become GET queries. Each needs a new request record (GET binds from route/query, so the request carries no body). `users/search` carries the `q` query parameter and must preserve that exact parameter name.

**Fallback (per-endpoint):** if any of these three produces a non-empty `src/api/` diff that cannot be reconciled (e.g. `users/search` param renamed, or an empty request record emitting an unexpected schema), revert *that one endpoint only* to its original static handler and mapping, and note it. The other conversions still stand.

**Files:**
- Create: `src/Wrangler.Api/Requests/RepositoriesRequest.cs`, `GroupedRepositoriesRequest.cs`, `UserSearchRequest.cs`
- Create: `src/Wrangler.Api/Handlers/RepositoriesQueryHandler.cs`, `GroupedRepositoriesQueryHandler.cs`, `UserSearchQueryHandler.cs`
- Delete: `src/Wrangler.Api/Handlers/RepositoriesHandler.cs`, `GroupedRepositoriesHandler.cs`, `UserSearchHandler.cs`
- Modify: `src/Wrangler.Api/Program.cs:260,261,262,263` (the three `api.MapGet(...)` lines; note `me` on line 260 stays)

**Interfaces:**
- Consumes: `IGitHubClient` (org/repo listing); `ISettingsService.ListAllWorkflowsAsync(CancellationToken) : Task<IEnumerable<AccountModel>>`; `IUserSearchService.SearchUsersAsync(string, CancellationToken) : Task<IEnumerable<UserSearchResult>>`.
- Produces: three request records and three query handlers.

- [ ] **Step 1: Create the three request records**

Create `src/Wrangler.Api/Requests/RepositoriesRequest.cs`:

```csharp
using Octokit;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to list all repositories accessible to the current user.</summary>
public record RepositoriesRequest : IQuery<IEnumerable<Repository>>;
```

Create `src/Wrangler.Api/Requests/GroupedRepositoriesRequest.cs`:

```csharp
using Asm.Wrangler.Api.Models.Settings;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to list all repositories grouped by owner, with their workflows.</summary>
public record GroupedRepositoriesRequest : IQuery<IEnumerable<AccountModel>>;
```

Create `src/Wrangler.Api/Requests/UserSearchRequest.cs`:

```csharp
using Asm.Wrangler.Api.Models.Users;
using Microsoft.AspNetCore.Mvc;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to search GitHub users for the pull-request author typeahead.</summary>
public record UserSearchRequest([FromQuery(Name = "q")] string Q) : IQuery<IEnumerable<UserSearchResult>>;
```

- [ ] **Step 2: Create the three query handlers**

Create `src/Wrangler.Api/Handlers/RepositoriesQueryHandler.cs` (replicates the original inline org iteration exactly):

```csharp
using Asm.Wrangler.Api.Requests;
using Octokit;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Retrieves all repositories from the user's organisations and personal account.</summary>
public class RepositoriesQueryHandler(IGitHubClient client)
    : IQueryHandler<RepositoriesRequest, IEnumerable<Repository>>
{
    public async ValueTask<IEnumerable<Repository>> Handle(RepositoriesRequest query, CancellationToken cancellationToken)
    {
        List<Repository> repositories = [];

        var orgs = await client.Organization.GetAllForCurrent();

        foreach (var org in orgs)
        {
            repositories.AddRange(await client.Repository.GetAllForOrg(org.Name));
        }

        repositories.AddRange(await client.Repository.GetAllForCurrent());

        return repositories;
    }
}
```

Create `src/Wrangler.Api/Handlers/GroupedRepositoriesQueryHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.Settings;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Retrieves all accessible repositories grouped by owner, with their available workflows.</summary>
public class GroupedRepositoriesQueryHandler(ISettingsService settingsService)
    : IQueryHandler<GroupedRepositoriesRequest, IEnumerable<AccountModel>>
{
    public ValueTask<IEnumerable<AccountModel>> Handle(GroupedRepositoriesRequest query, CancellationToken cancellationToken) =>
        new(settingsService.ListAllWorkflowsAsync(cancellationToken));
}
```

Create `src/Wrangler.Api/Handlers/UserSearchQueryHandler.cs`:

```csharp
using Asm.Wrangler.Api.Models.Users;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Postie.Cqrs.Queries;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Searches GitHub users matching the query string.</summary>
public class UserSearchQueryHandler(IUserSearchService service)
    : IQueryHandler<UserSearchRequest, IEnumerable<UserSearchResult>>
{
    public ValueTask<IEnumerable<UserSearchResult>> Handle(UserSearchRequest query, CancellationToken cancellationToken) =>
        new(service.SearchUsersAsync(query.Q ?? string.Empty, cancellationToken));
}
```

- [ ] **Step 3: Delete the three old static handlers**

```bash
git rm src/Wrangler.Api/Handlers/RepositoriesHandler.cs src/Wrangler.Api/Handlers/GroupedRepositoriesHandler.cs src/Wrangler.Api/Handlers/UserSearchHandler.cs
```

- [ ] **Step 4: Replace the three endpoint mappings (leave `me` untouched)**

In `src/Wrangler.Api/Program.cs`, replace:

```csharp
    api.MapGet("repositories", RepositoriesHandler.Handle);
    api.MapGet("repositories/grouped", GroupedRepositoriesHandler.Handle);
    api.MapGet("users/search", UserSearchHandler.Handle);
```
with:
```csharp
    api.MapQuery<RepositoriesRequest, IEnumerable<Repository>>("repositories");
    api.MapQuery<GroupedRepositoriesRequest, IEnumerable<AccountModel>>("repositories/grouped");
    api.MapQuery<UserSearchRequest, IEnumerable<UserSearchResult>>("users/search");
```

Add usings at the top of `Program.cs` if not present: `using Asm.Wrangler.Api.Models.Settings;`, `using Asm.Wrangler.Api.Models.Users;`, `using Asm.Wrangler.Api.Requests;`. (`Octokit` is already imported.)

Do **not** change the `api.MapGet("me", MeHandler.Handle);` line.

- [ ] **Step 5: Build and inspect the OpenAPI diff**

Run: `cd src/Wrangler.Api && dotnet build`
Then: `git diff src/Wrangler.Api/openapi-v1.json`
Expected: build succeeds. Diffs limited to added `"404"` responses on `/repositories`, `/repositories/grouped`, `/users/search`. Critically, the `/users/search` `get` still declares a query parameter named exactly **`q`** (from `[FromQuery(Name = "q")]`), unchanged. No new request-body schema components for the empty records.

- [ ] **Step 6: Regenerate the frontend client and verify additive-only**

Run: `cd src/Wrangler.App && npm run generate`
Then: `git diff --ignore-all-space src/Wrangler.App/src/api/`
Expected: only *additive* changes — new `GetRepositoriesErrors`, `GetRepositoriesGroupedErrors`, `GetUsersSearchErrors` (`{ 404: unknown }`) types and the matching error-param change on `getRepositories`/`getRepositoriesGrouped`/`getUsersSearch`. Critically, **`getUsersSearch` must keep its `q` query parameter** — same name, same type — and no request/response-body type may change. If any endpoint shows a *breaking* change (renamed/removed function, changed param, changed body type), apply the per-endpoint fallback (revert just that one to its static handler) and re-run.
Then: `npm run build && npm test && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit (including the regenerated client)**

```bash
git add src/Wrangler.Api/Requests/ src/Wrangler.Api/Handlers/ src/Wrangler.Api/Program.cs src/Wrangler.Api/openapi-v1.json src/Wrangler.App/src/api/
git commit -m "Convert repositories, grouped, and user-search GET endpoints to Postie MapQuery"
```

(Do NOT stage `src/Wrangler.App/src/routeTree.gen.ts`.)

---

### Task 6: Handler-registration smoke test and full verification

Adds the one new automated test (reflection-based: every CQRS request type has a matching handler — catches a missing registration at test time) and runs the complete backend + frontend gate.

**Files:**
- Create: `tests/Wrangler.Tests/Cqrs/HandlerRegistrationTests.cs`

**Interfaces:**
- Consumes: all request/handler types created in Tasks 2–5; `Postie.Cqrs.Queries.IQuery<>`, `Postie.Cqrs.Commands.ICommand<>`, `ICommand`, `IQueryHandler<,>`, `ICommandHandler<,>`, `ICommandHandler<>`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

Create `tests/Wrangler.Tests/Cqrs/HandlerRegistrationTests.cs`:

```csharp
using System.Reflection;
using Asm.Wrangler.Api.Requests;
using Postie.Cqrs.Commands;
using Postie.Cqrs.Queries;
using Xunit;

namespace Wrangler.Tests.Cqrs;

public class HandlerRegistrationTests
{
    private static readonly Assembly ApiAssembly = typeof(WorkflowsRequest).Assembly;

    // Request types that carry a CQRS marker interface (IQuery<T>, ICommand<T>, or ICommand).
    public static IEnumerable<object[]> CqrsRequestTypes() =>
        ApiAssembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .Where(t => t.GetInterfaces().Any(IsCqrsMarker))
            .Select(t => new object[] { t });

    private static bool IsCqrsMarker(Type i) =>
        i == typeof(ICommand) ||
        (i.IsGenericType && (i.GetGenericTypeDefinition() == typeof(IQuery<>) ||
                             i.GetGenericTypeDefinition() == typeof(ICommand<>)));

    [Theory]
    [MemberData(nameof(CqrsRequestTypes))]
    public void Every_cqrs_request_has_exactly_one_handler(Type requestType)
    {
        var handlerCount = ApiAssembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .Count(t => t.GetInterfaces().Any(i => IsHandlerFor(i, requestType)));

        Assert.Equal(1, handlerCount);
    }

    // True when interface i is an IQueryHandler/ICommandHandler whose first generic argument
    // (the request type) is requestType.
    private static bool IsHandlerFor(Type i, Type requestType)
    {
        if (!i.IsGenericType) return false;
        var def = i.GetGenericTypeDefinition();
        var isHandler = def == typeof(IQueryHandler<,>) ||
                        def == typeof(ICommandHandler<,>) ||
                        def == typeof(ICommandHandler<>);
        return isHandler && i.GetGenericArguments()[0] == requestType;
    }
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd tests/Wrangler.Tests && dotnet test --filter "FullyQualifiedName~HandlerRegistrationTests"`
Expected: PASS. There should be nine theory cases (the nine converted request types), each finding exactly one handler. If any case finds `0`, a handler is missing; if `2`, there is a duplicate.

- [ ] **Step 3: Run the full backend test suite**

Run: `cd tests/Wrangler.Tests && dotnet test`
Expected: all tests pass (the existing pure-logic suites are unaffected; the new registration test passes).

- [ ] **Step 4: Run the full frontend gate**

Run: `cd src/Wrangler.App && npm run generate`
Then: `git diff --ignore-all-space src/api/`
Expected: no *semantic* change beyond what earlier tasks already committed (the additive `*Errors` types are already in the committed client). Any diff here should be formatting-only or empty. No renamed/removed functions/hooks/types.
Then: `npm test && npm run lint && npm run build`
Expected: all green.
If `git diff src/api/` shows only formatting churn, commit it (`git add src/Wrangler.App/src/api/`); otherwise leave it clean.

- [ ] **Step 5: Confirm the kept-raw endpoints are intact**

Verify `src/Wrangler.Api/Program.cs` still maps, unchanged: `api.MapGet("me", MeHandler.Handle);`, `api.MapPost("repositories/{owner}/{repo}/workflows/", RepositoriesWorkflowsHandler.Handle)` with `.WithNames("Get Workflows for a Repository")` and `.Produces<IEnumerable<WorkflowModel>>()`, and `api.MapPost("repositories/{owner}/{repo}/workflows/{workflowId}/runs", WorkflowRunsHandler.Handle).DisableAntiforgery()`. Confirm `MeHandler.cs`, `RepositoriesWorkflowsHandler.cs`, and `WorkflowRunsHandler.cs` still exist.

- [ ] **Step 6: Commit**

```bash
git add tests/Wrangler.Tests/Cqrs/HandlerRegistrationTests.cs
git commit -m "Add Postie handler-registration smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (marker + thin handler) → Tasks 2–5. Section 2 endpoint mapping → Tasks 2–5, with `me` and the two `repositories/{owner}/{repo}/…` endpoints kept raw per the spec's own fallback plus the newly-discovered `me` 401/404 contract issue (Global Constraints). Section 3 (OpenAPI/client gate) → the build + openapi-diff + client-regen steps in every task. Section 4 (packages/wiring/testing) → Task 1 (package + `AddPostie`) and Task 6 (smoke test + full gate).
- **Deviation from spec Section 2:** three endpoints stay raw minimal API (`me`, and the two repo-scoped workflow endpoints). Reasons in Global Constraints. This is surfaced to the user before execution.
- **Type consistency:** handler class names, request record names, marker interfaces, and service method signatures are cross-checked against the reference table in File Structure.
```