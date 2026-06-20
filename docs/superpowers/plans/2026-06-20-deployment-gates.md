# Deployment Gates (approve) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user view workflow runs paused at environment protection rules ("gates") across their selected repositories and batch-approve them without leaving Wrangler.

**Architecture:** A `GitHubService`-derived backend service (`GateService`) discovers waiting runs and their pending deployments via Octokit (using `IConnection.Get` for the read, since Octokit 14 has no typed pending-deployments read), exposed through two minimal-API handlers. A new `/gates` TanStack-Router page consumes the generated client through React Query hooks and mirrors the existing Pull Requests batch-approve interaction (multi-select → "Approve Selected" → per-result toasts/alerts).

**Tech Stack:** .NET 10 / ASP.NET Core minimal API, Octokit 14, xunit.v3 (no mocking lib); React + Vite + TanStack Router/Query, `@andrewmclachlan/moo-ds`, `@hey-api/openapi-ts`-generated client.

## Global Constraints

- Backend handlers are static classes with a static `Handle` method; routes are mapped in `src/Wrangler.Api/Program.cs`.
- Backend services extend `GitHubService` (retry via `OctoCall`, throttle via `Jitter`, bounded fan-out via a `SemaphoreSlim _gate = new(8)`).
- The frontend API client in `src/Wrangler.App/src/api/` is **auto-generated** — never hand-edit it; regenerate with `npm run generate` against the running backend.
- TanStack Router route tree (`routeTree.gen.ts`) is auto-generated on build/dev — do not edit it by hand.
- CSS uses `@scope` for component isolation; per-component files live in `src/Wrangler.App/src/css/components/` and are `@import`ed from `src/Wrangler.App/src/css/components.css`.
- Approve-only for v1: no reject, no review comment (the GitHub review API accepts an empty comment string).
- Types/method names that later tasks rely on are listed in each task's **Interfaces** block — use them verbatim.

---

### Task 1: Backend models and request types

**Files:**
- Create: `src/Wrangler.Api/Models/Gates/DeploymentGateModel.cs`
- Create: `src/Wrangler.Api/Models/Gates/PendingDeploymentResponse.cs`
- Create: `src/Wrangler.Api/Models/Gates/GateApprovalResult.cs`
- Create: `src/Wrangler.Api/Requests/GatesRequest.cs`
- Create: `src/Wrangler.Api/Requests/ApproveGatesRequest.cs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Asm.Wrangler.Api.Models.Gates.DeploymentGateModel` (record) with init properties: `string RepositoryOwner`, `string RepositoryName`, `long WorkflowRunId`, `long RunNumber`, `string WorkflowName`, `string HeadBranch`, `string Event`, `string HtmlUrl`, `DateTimeOffset CreatedAt`, `DateTimeOffset UpdatedAt`, `long EnvironmentId`, `string EnvironmentName`, `bool CurrentUserCanApprove`.
  - `Asm.Wrangler.Api.Models.Gates.PendingDeploymentResponse` (class) with `PendingDeploymentEnvironment Environment` and `bool CurrentUserCanApprove`; `PendingDeploymentEnvironment` with `long Id`, `string Name`.
  - `Asm.Wrangler.Api.Models.Gates.GateApprovalResult` (record): `string RepositoryOwner`, `string RepositoryName`, `long WorkflowRunId`, `string EnvironmentName`, `bool Approved`, `string? Error`.
  - `Asm.Wrangler.Api.Requests.GatesRequest` with nested `RepositoryRequest { string Owner; string Name; }` and `IReadOnlyList<RepositoryRequest> Repositories`.
  - `Asm.Wrangler.Api.Requests.ApproveGatesRequest` with `IReadOnlyList<GateRef> Gates`; `Asm.Wrangler.Api.Requests.GateRef { string Owner; string Repo; long RunId; long EnvironmentId; string EnvironmentName; }`.

- [ ] **Step 1: Create `DeploymentGateModel.cs`**

```csharp
namespace Asm.Wrangler.Api.Models.Gates;

/// <summary>
/// A workflow run paused at an environment protection rule (a "gate"),
/// surfaced once per pending environment.
/// </summary>
public record DeploymentGateModel
{
    public required string RepositoryOwner { get; init; }
    public required string RepositoryName { get; init; }
    public required long WorkflowRunId { get; init; }
    public required long RunNumber { get; init; }
    public required string WorkflowName { get; init; }
    public required string HeadBranch { get; init; }
    public required string Event { get; init; }
    public required string HtmlUrl { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required DateTimeOffset UpdatedAt { get; init; }
    public required long EnvironmentId { get; init; }
    public required string EnvironmentName { get; init; }

    /// <summary>Whether the current user is eligible to approve this gate.</summary>
    public required bool CurrentUserCanApprove { get; init; }
}
```

- [ ] **Step 2: Create `PendingDeploymentResponse.cs`**

```csharp
namespace Asm.Wrangler.Api.Models.Gates;

/// <summary>
/// Subset of GitHub's <c>pending_deployments</c> REST payload. Octokit 14
/// exposes the review (write) but no typed read, so we deserialise this via
/// <c>IConnection.Get</c>. Octokit's serializer maps PascalCase property
/// names to the snake_case JSON keys (e.g. <c>current_user_can_approve</c>).
/// </summary>
public class PendingDeploymentResponse
{
    public PendingDeploymentEnvironment Environment { get; set; } = new();
    public bool CurrentUserCanApprove { get; set; }
}

public class PendingDeploymentEnvironment
{
    public long Id { get; set; }
    public string Name { get; set; } = String.Empty;
}
```

- [ ] **Step 3: Create `GateApprovalResult.cs`**

```csharp
namespace Asm.Wrangler.Api.Models.Gates;

/// <summary>The outcome of approving a single deployment gate.</summary>
public record GateApprovalResult
{
    public required string RepositoryOwner { get; init; }
    public required string RepositoryName { get; init; }
    public required long WorkflowRunId { get; init; }
    public required string EnvironmentName { get; init; }
    public required bool Approved { get; init; }
    public string? Error { get; init; }
}
```

- [ ] **Step 4: Create `GatesRequest.cs`**

```csharp
namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to list pending deployment gates across repositories.</summary>
public record GatesRequest
{
    /// <summary>A repository identified by owner and name.</summary>
    public record RepositoryRequest
    {
        public required string Owner { get; init; }
        public required string Name { get; init; }
    }

    /// <summary>The repositories to scan for waiting runs.</summary>
    public IReadOnlyList<RepositoryRequest> Repositories { get; init; } = [];
}
```

- [ ] **Step 5: Create `ApproveGatesRequest.cs`**

```csharp
namespace Asm.Wrangler.Api.Requests;

/// <summary>Request to approve the specified deployment gates.</summary>
public record ApproveGatesRequest
{
    public IReadOnlyList<GateRef> Gates { get; init; } = [];
}

/// <summary>Identifies a single gate: one pending environment on one run.</summary>
public record GateRef
{
    public required string Owner { get; init; }
    public required string Repo { get; init; }
    public required long RunId { get; init; }
    public required long EnvironmentId { get; init; }
    public required string EnvironmentName { get; init; }
}
```

- [ ] **Step 6: Build to verify the new types compile**

Run: `cd src/Wrangler.Api && dotnet build`
Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/Wrangler.Api/Models/Gates src/Wrangler.Api/Requests/GatesRequest.cs src/Wrangler.Api/Requests/ApproveGatesRequest.cs
git commit -m "Add deployment gate models and request types (#142)"
```

---

### Task 2: Gate review grouping helper (TDD)

Pure logic that turns a flat list of selected gates into one review call per run. This is the unit-tested core; the GitHub-touching service in Task 3 is verified by build + manual smoke test (the test project has no mocking library, matching existing tests which exercise pure logic only).

**Files:**
- Create: `src/Wrangler.Api/Services/GateReviewPlanner.cs`
- Test: `tests/Wrangler.Tests/GateReviewPlannerTests.cs`

**Interfaces:**
- Consumes: `Asm.Wrangler.Api.Requests.GateRef` (Task 1).
- Produces:
  - `Asm.Wrangler.Api.Services.GateReviewGroup` (readonly record struct): `string Owner`, `string Repo`, `long RunId`, `IReadOnlyList<GateRef> Gates`, and a computed `IReadOnlyList<long> EnvironmentIds` (distinct env ids).
  - `Asm.Wrangler.Api.Services.GateReviewPlanner.GroupForReview(IEnumerable<GateRef>) -> IReadOnlyList<GateReviewGroup>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Wrangler.Tests/GateReviewPlannerTests.cs`:

```csharp
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;

namespace Asm.Wrangler.Tests;

public class GateReviewPlannerTests
{
    private static GateRef Ref(string owner, string repo, long runId, long envId) =>
        new() { Owner = owner, Repo = repo, RunId = runId, EnvironmentId = envId, EnvironmentName = $"env-{envId}" };

    [Fact]
    public void Groups_Gates_By_Run_And_Collects_Environment_Ids()
    {
        var groups = GateReviewPlanner.GroupForReview(
        [
            Ref("acme", "web", 100, 1),
            Ref("acme", "web", 100, 2),
            Ref("acme", "web", 200, 3),
        ]);

        Assert.Equal(2, groups.Count);

        var run100 = groups.Single(g => g.RunId == 100);
        Assert.Equal("acme", run100.Owner);
        Assert.Equal("web", run100.Repo);
        Assert.Equal(new long[] { 1, 2 }, run100.EnvironmentIds.OrderBy(x => x).ToArray());

        var run200 = groups.Single(g => g.RunId == 200);
        Assert.Equal(new long[] { 3 }, run200.EnvironmentIds.ToArray());
    }

    [Fact]
    public void Deduplicates_Environment_Ids_Within_A_Run()
    {
        var groups = GateReviewPlanner.GroupForReview(
        [
            Ref("acme", "web", 100, 5),
            Ref("acme", "web", 100, 5),
        ]);

        var group = Assert.Single(groups);
        Assert.Equal(new long[] { 5 }, group.EnvironmentIds.ToArray());
    }

    [Fact]
    public void Separates_Same_RunId_Across_Different_Repos()
    {
        var groups = GateReviewPlanner.GroupForReview(
        [
            Ref("acme", "web", 100, 1),
            Ref("acme", "api", 100, 1),
        ]);

        Assert.Equal(2, groups.Count);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/Wrangler.Tests/Wrangler.Tests.csproj`
Expected: FAIL — `GateReviewPlanner`/`GateReviewGroup` do not exist (compile error).

- [ ] **Step 3: Implement `GateReviewPlanner.cs`**

```csharp
using Asm.Wrangler.Api.Requests;

namespace Asm.Wrangler.Api.Services;

/// <summary>A workflow run whose pending environments are reviewed together.</summary>
public readonly record struct GateReviewGroup(string Owner, string Repo, long RunId, IReadOnlyList<GateRef> Gates)
{
    /// <summary>The distinct environment ids to submit in a single review call.</summary>
    public IReadOnlyList<long> EnvironmentIds => [.. Gates.Select(g => g.EnvironmentId).Distinct()];
}

/// <summary>
/// Pure grouping logic: turns a flat list of selected gates into one review
/// group per (owner, repo, run) so each run is approved in a single API call.
/// </summary>
public static class GateReviewPlanner
{
    public static IReadOnlyList<GateReviewGroup> GroupForReview(IEnumerable<GateRef> gates) =>
        [.. gates
            .GroupBy(g => (g.Owner, g.Repo, g.RunId))
            .Select(grp => new GateReviewGroup(grp.Key.Owner, grp.Key.Repo, grp.Key.RunId, [.. grp]))];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test tests/Wrangler.Tests/Wrangler.Tests.csproj`
Expected: PASS — all `GateReviewPlannerTests` green.

- [ ] **Step 5: Commit**

```bash
git add src/Wrangler.Api/Services/GateReviewPlanner.cs tests/Wrangler.Tests/GateReviewPlannerTests.cs
git commit -m "Add gate review grouping helper with tests (#142)"
```

---

### Task 3: GateService

**Files:**
- Create: `src/Wrangler.Api/Services/GateService.cs`

**Interfaces:**
- Consumes: `DeploymentGateModel`, `PendingDeploymentResponse`, `GateApprovalResult`, `GatesRequest`, `ApproveGatesRequest`, `GateRef` (Task 1); `GateReviewPlanner.GroupForReview`, `GateReviewGroup` (Task 2). Octokit: `IGitHubClient.Actions.Workflows.Runs.List`, `IGitHubClient.Connection.Get<T>`, `IGitHubClient.Actions.Workflows.Runs.ReviewPendingDeployments`, `ApiUrls.ActionsWorkflowRunPendingDeployments`, `CheckRunStatusFilter.Waiting`, `PendingDeploymentReview`, `PendingDeploymentReviewState.Approved`.
- Produces:
  - `Asm.Wrangler.Api.Services.IGateService` with `Task<IEnumerable<DeploymentGateModel>> GetGatesAsync(GatesRequest, CancellationToken)` and `Task<IEnumerable<GateApprovalResult>> ApproveGatesAsync(ApproveGatesRequest, CancellationToken)`.
  - `internal class GateService` implementing it (registered in Task 4).

- [ ] **Step 1: Create `GateService.cs`**

```csharp
using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Discovers workflow runs paused at environment protection rules and
/// approves them on the user's behalf.
/// </summary>
public interface IGateService
{
    Task<IEnumerable<DeploymentGateModel>> GetGatesAsync(GatesRequest request, CancellationToken cancellationToken);
    Task<IEnumerable<GateApprovalResult>> ApproveGatesAsync(ApproveGatesRequest request, CancellationToken cancellationToken);
}

internal class GateService(IGitHubClient gitHubClient, IDistributedCache cache, ILogger<GateService> logger)
    : GitHubService(cache, logger), IGateService
{
    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<DeploymentGateModel>> GetGatesAsync(GatesRequest request, CancellationToken cancellationToken)
    {
        var repoTasks = request.Repositories.Select(repo => GetRepoGatesAsync(repo.Owner, repo.Name, cancellationToken));
        var perRepo = await Task.WhenAll(repoTasks);

        return perRepo
            .SelectMany(items => items)
            .OrderByDescending(item => item.UpdatedAt);
    }

    private async Task<IEnumerable<DeploymentGateModel>> GetRepoGatesAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        WorkflowRunsResponse waitingRuns;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            waitingRuns = await OctoCall(() => gitHubClient.Actions.Workflows.Runs.List(owner, repo, new WorkflowRunsRequest
            {
                Status = new StringEnum<CheckRunStatusFilter>(CheckRunStatusFilter.Waiting),
            }), cancellationToken);
        }
        finally
        {
            _gate.Release();
        }

        var runTasks = waitingRuns.WorkflowRuns.Select(run => GetRunGatesAsync(owner, repo, run, cancellationToken));
        var perRun = await Task.WhenAll(runTasks);
        return perRun.SelectMany(g => g);
    }

    private async Task<IEnumerable<DeploymentGateModel>> GetRunGatesAsync(string owner, string repo, WorkflowRun run, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            // Octokit 14 has no typed read for pending deployments, so hit the
            // REST endpoint directly. Octokit's serializer maps the snake_case
            // JSON onto our PascalCase PendingDeploymentResponse.
            var response = await OctoCall(() => gitHubClient.Connection.Get<PendingDeploymentResponse[]>(
                ApiUrls.ActionsWorkflowRunPendingDeployments(owner, repo, run.Id), null, null, cancellationToken), cancellationToken);

            var pending = response.Body ?? [];

            return pending.Select(p => new DeploymentGateModel
            {
                RepositoryOwner = owner,
                RepositoryName = repo,
                WorkflowRunId = run.Id,
                RunNumber = run.RunNumber,
                WorkflowName = run.Name,
                HeadBranch = run.HeadBranch,
                Event = run.Event,
                HtmlUrl = run.HtmlUrl,
                CreatedAt = run.CreatedAt,
                UpdatedAt = run.UpdatedAt,
                EnvironmentId = p.Environment.Id,
                EnvironmentName = p.Environment.Name,
                CurrentUserCanApprove = p.CurrentUserCanApprove,
            }).ToList();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IEnumerable<GateApprovalResult>> ApproveGatesAsync(ApproveGatesRequest request, CancellationToken cancellationToken)
    {
        var groups = GateReviewPlanner.GroupForReview(request.Gates);

        var groupTasks = groups.Select(group => ApproveRunAsync(group, cancellationToken));
        var perGroup = await Task.WhenAll(groupTasks);
        return perGroup.SelectMany(r => r);
    }

    private async Task<IEnumerable<GateApprovalResult>> ApproveRunAsync(GateReviewGroup group, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            var review = new PendingDeploymentReview([.. group.EnvironmentIds], PendingDeploymentReviewState.Approved, String.Empty);

            try
            {
                await OctoCall(() => gitHubClient.Actions.Workflows.Runs.ReviewPendingDeployments(
                    group.Owner, group.Repo, group.RunId, review), cancellationToken);

                return group.Gates.Select(g => new GateApprovalResult
                {
                    RepositoryOwner = group.Owner,
                    RepositoryName = group.Repo,
                    WorkflowRunId = group.RunId,
                    EnvironmentName = g.EnvironmentName,
                    Approved = true,
                }).ToList();
            }
            catch (Exception ex)
            {
                return group.Gates.Select(g => new GateApprovalResult
                {
                    RepositoryOwner = group.Owner,
                    RepositoryName = group.Repo,
                    WorkflowRunId = group.RunId,
                    EnvironmentName = g.EnvironmentName,
                    Approved = false,
                    Error = ex.Message,
                }).ToList();
            }
        }
        finally
        {
            _gate.Release();
        }
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `cd src/Wrangler.Api && dotnet build`
Expected: Build succeeded, 0 errors. (If `Connection.Get<T>`'s overload resolution complains about the `null` arguments, cast the first to `(IDictionary<string, string>?)null` and the second to `(string?)null`.)

- [ ] **Step 3: Commit**

```bash
git add src/Wrangler.Api/Services/GateService.cs
git commit -m "Add GateService for listing and approving gates (#142)"
```

---

### Task 4: Handlers and route registration

**Files:**
- Create: `src/Wrangler.Api/Handlers/GatesHandler.cs`
- Create: `src/Wrangler.Api/Handlers/ApproveGatesHandler.cs`
- Modify: `src/Wrangler.Api/Program.cs` (DI registration near the other `AddScoped` service lines; route mapping near the `attention` route)

**Interfaces:**
- Consumes: `IGateService` (Task 3), `GatesRequest`, `ApproveGatesRequest`, `DeploymentGateModel`, `GateApprovalResult` (Task 1).
- Produces: `POST /api/gates` and `POST /api/gates/approve` endpoints.

- [ ] **Step 1: Create `GatesHandler.cs`**

```csharp
using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Lists pending deployment gates across the requested repositories.</summary>
public static class GatesHandler
{
    public static Task<IEnumerable<DeploymentGateModel>> Handle(
        [FromServices] IGateService service,
        [FromBody] GatesRequest request,
        CancellationToken cancellationToken) =>
        service.GetGatesAsync(request, cancellationToken);
}
```

- [ ] **Step 2: Create `ApproveGatesHandler.cs`**

```csharp
using Asm.Wrangler.Api.Models.Gates;
using Asm.Wrangler.Api.Requests;
using Asm.Wrangler.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>Approves the specified deployment gates.</summary>
public static class ApproveGatesHandler
{
    public static Task<IEnumerable<GateApprovalResult>> Handle(
        [FromServices] IGateService service,
        [FromBody] ApproveGatesRequest request,
        CancellationToken cancellationToken) =>
        service.ApproveGatesAsync(request, cancellationToken);
}
```

- [ ] **Step 3: Register `IGateService` in `Program.cs`**

In `AddServices`, immediately after the line `builder.Services.AddScoped<IAttentionService, AttentionService>();`, add:

```csharp
        builder.Services.AddScoped<IGateService, GateService>();
```

- [ ] **Step 4: Map the routes in `Program.cs`**

In `AddApp`, immediately after the line `api.MapPost("attention", AttentionHandler.Handle).DisableAntiforgery();`, add:

```csharp
    api.MapPost("gates", GatesHandler.Handle).DisableAntiforgery();
    api.MapPost("gates/approve", ApproveGatesHandler.Handle);
```

(The approve endpoint intentionally keeps antiforgery enabled, mirroring `pull-requests/approve`.)

- [ ] **Step 5: Build to verify it compiles**

Run: `cd src/Wrangler.Api && dotnet build`
Expected: Build succeeded, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/Wrangler.Api/Handlers/GatesHandler.cs src/Wrangler.Api/Handlers/ApproveGatesHandler.cs src/Wrangler.Api/Program.cs
git commit -m "Map gate list and approve endpoints (#142)"
```

---

### Task 5: Regenerate the frontend API client

The client is generated from the **static** `src/Wrangler.Api/openapi-v1.json`. The
API csproj has `OpenApiGenerateDocuments=true` (via `Microsoft.Extensions.ApiDescription.Server`),
so a normal `dotnet build` of the API re-emits that file — no running server is
needed. `openapi-ts.config.ts` reads it as its `input`.

**Files:**
- Modify (build artifact, checked in): `src/Wrangler.Api/openapi-v1.json`
- Modify (generated, do not hand-edit): `src/Wrangler.App/src/api/*`

**Interfaces:**
- Consumes: the `/api/gates` and `/api/gates/approve` endpoints (Task 4).
- Produces (generated names later tasks import): `postGates`, `postGatesApprove` (from `sdk.gen.ts`); types `DeploymentGateModel`, `GateApprovalResult`, `GateRef`, `GatesRequest`, `ApproveGatesRequest` (re-exported via `src/api/index.ts`).

- [ ] **Step 1: Build the API to refresh the OpenAPI document**

Run: `cd src/Wrangler.Api && dotnet build`
Expected: build succeeds; `src/Wrangler.Api/openapi-v1.json` now contains `/gates` and `/gates/approve` paths. Confirm with:
`grep -n "/gates" src/Wrangler.Api/openapi-v1.json`
Expected: matches for both `/gates` and `/gates/approve`.

- [ ] **Step 2: Regenerate the client**

Run: `cd src/Wrangler.App && npm run generate`
Expected: files under `src/api/` updated; `git status` shows changes in `sdk.gen.ts`, `types.gen.ts`, `@tanstack/react-query.gen.ts`.

- [ ] **Step 3: Confirm the new symbols were generated**

Run: `grep -n "postGates\b\|postGatesApprove\|GateApprovalResult\|DeploymentGateModel\|GateRef" src/Wrangler.App/src/api/sdk.gen.ts src/Wrangler.App/src/api/types.gen.ts`
Expected: matches for `postGates`, `postGatesApprove`, and each type. If `GateRef` is absent, confirm it appears nested in `ApproveGatesRequest` and adjust Task 6's import accordingly.

- [ ] **Step 4: Verify the frontend still builds**

Run: `cd src/Wrangler.App && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/Wrangler.Api/openapi-v1.json src/Wrangler.App/src/api
git commit -m "Regenerate API client with gate endpoints (#142)"
```

---

### Task 6: Frontend hooks (useGates, useApproveGates)

**Files:**
- Create: `src/Wrangler.App/src/routes/gates/-hooks/useGates.ts`
- Create: `src/Wrangler.App/src/routes/gates/-hooks/useApproveGates.ts`

**Interfaces:**
- Consumes: `postGates`, `postGatesApprove`, types `GateApprovalResult`, `GateRef` (Task 5); `useSelectedRepositories` from `../../settings/-hooks/useSelectedRepositories`.
- Produces:
  - `useGates()` — React Query hook returning `DeploymentGateModel[]`, query key `["gates", repositories]`.
  - `useApproveGates({ onResults? })` — mutation; `mutate(gates: GateRef[])`; invalidates `["gates"]` and calls `onResults` with `GateApprovalResult[]`.

- [ ] **Step 1: Create `useGates.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { postGates } from "../../../api";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";

export const useGates = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  const repositories = selectedRepositories.map((r) => ({ owner: r.owner, name: r.name }));

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

- [ ] **Step 2: Create `useApproveGates.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postGatesApprove, type GateApprovalResult, type GateRef } from "../../../api";

interface UseApproveGatesOptions {
  onResults?: (results: GateApprovalResult[]) => void;
}

export const useApproveGates = (options?: UseApproveGatesOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gates: GateRef[]) => {
      const result = await postGatesApprove({ body: { gates } });
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gates"] });
      options?.onResults?.(data as GateApprovalResult[]);
    },
  });
};
```

- [ ] **Step 3: Verify the build (type-checks the hooks)**

Run: `cd src/Wrangler.App && npm run build`
Expected: build succeeds. (If `GateRef` is not exported, import it as the element type of `ApproveGatesRequest["gates"]` instead.)

- [ ] **Step 4: Commit**

```bash
git add src/Wrangler.App/src/routes/gates/-hooks
git commit -m "Add gates data hooks (#142)"
```

---

### Task 7: Gates page, route, and styles

**Files:**
- Create: `src/Wrangler.App/src/routes/gates.tsx`
- Create: `src/Wrangler.App/src/routes/gates/-components/Gates.tsx`
- Create: `src/Wrangler.App/src/css/components/gates.css`
- Modify: `src/Wrangler.App/src/css/components.css` (add the `@import`)

**Interfaces:**
- Consumes: `useGates`, `useApproveGates` (Task 6); `DeploymentGateModel`, `GateApprovalResult` (Task 5); `NoRepositories` from `../../../components/NoRepositories`; `Alert`, `Badge`, `DataGrid`, `ColumnDef` from `@andrewmclachlan/moo-ds`.
- Produces: route `/gates` rendering the `Gates` component (picked up automatically by the route-tree generator).

- [ ] **Step 1: Create the route file `gates.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Gates } from "./gates/-components/Gates";

export const Route = createFileRoute("/gates")({
  component: Gates,
});
```

- [ ] **Step 2: Create `gates/-components/Gates.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Alert, Badge, DataGrid, type ColumnDef } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import { useGates } from "../-hooks/useGates";
import { useApproveGates } from "../-hooks/useApproveGates";
import { useSelectedRepositories } from "../../settings/-hooks/useSelectedRepositories";
import { NoRepositories } from "../../../components/NoRepositories";
import type { DeploymentGateModel, GateApprovalResult } from "../../../api";

const formatter = new Intl.RelativeTimeFormat(navigator.language, { style: "long" });

const gateKey = (g: DeploymentGateModel) =>
  `${g.repositoryOwner}/${g.repositoryName}:${g.workflowRunId}:${g.environmentId}`;

export const Gates = () => {
  const { data: selectedRepositories } = useSelectedRepositories();
  const { data: gates, isLoading, isError, error } = useGates();
  const [alerts, setAlerts] = useState<GateApprovalResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { mutate: approveGates, isPending: isApproving } = useApproveGates({
    onResults: (results) => {
      const failures: GateApprovalResult[] = [];
      for (const result of results) {
        if (result.approved) {
          toast.success(`${result.repositoryOwner}/${result.repositoryName} · ${result.environmentName}: Approved`);
        } else {
          failures.push(result);
        }
      }
      // Approved gates stop being "waiting" and drop out on the next refetch
      // (triggered by the mutation's query invalidation), so just clear the
      // selection and surface any failures.
      setSelected(new Set());
      setAlerts(failures);
    },
  });

  const visibleGates = useMemo(() => gates ?? [], [gates]);
  const approvable = useMemo(() => visibleGates.filter((g) => g.currentUserCanApprove), [visibleGates]);

  const toggleSelection = (g: DeploymentGateModel) => {
    if (!g.currentUserCanApprove || isApproving) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const key = gateKey(g);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = approvable.length > 0 && approvable.every((g) => selected.has(gateKey(g)));

  const toggleSelectAll = () => {
    if (isApproving) return;
    setSelected(allSelected ? new Set() : new Set(approvable.map(gateKey)));
  };

  const handleApprove = () => {
    if (!gates) return;
    const toApprove = gates
      .filter((g) => selected.has(gateKey(g)))
      .map((g) => ({
        owner: g.repositoryOwner,
        repo: g.repositoryName,
        runId: g.workflowRunId,
        environmentId: g.environmentId,
        environmentName: g.environmentName,
      }));
    approveGates(toApprove);
  };

  const columns: ColumnDef<DeploymentGateModel>[] = useMemo(() => [
    {
      field: () => null,
      id: "select",
      header: () => <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={approvable.length === 0 || isApproving} />,
      cell: ({ row }) => <input type="checkbox" checked={selected.has(gateKey(row.original))} onChange={() => toggleSelection(row.original)} disabled={!row.original.currentUserCanApprove || isApproving} />,
      enableSorting: false,
    },
    {
      field: (g: DeploymentGateModel) => `${g.repositoryOwner}/${g.repositoryName}`,
      id: "repository",
      header: "Repository",
      enableSorting: true,
    },
    {
      field: "workflowName",
      header: "Workflow",
      cell: ({ row }) => (
        <a href={row.original.htmlUrl!} target="_blank" rel="noopener noreferrer">
          {row.original.workflowName} #{row.original.runNumber}
        </a>
      ),
      enableSorting: true,
    },
    {
      field: "environmentName",
      header: "Environment",
      cell: ({ row }) => <Badge className="gate-environment" pill>{row.original.environmentName}</Badge>,
      enableSorting: true,
    },
    {
      field: "headBranch",
      header: "Branch",
      enableSorting: true,
    },
    {
      field: "updatedAt",
      header: "Updated",
      cell: ({ getValue }) => {
        const updatedAt = DateTime.fromISO(getValue() as string);
        const timeAgo = updatedAt.toRelative({ style: "long" }) || formatter.format(0, "seconds");
        return <span title={updatedAt.toFormat("yyyy-MM-dd HH:mm:ss")}>{timeAgo}</span>;
      },
      enableSorting: true,
    },
    {
      field: () => null,
      id: "open",
      header: "",
      cell: ({ row }) => (
        <a className="gate-open-link" href={row.original.htmlUrl!} target="_blank" rel="noopener noreferrer" title="Open on GitHub" aria-label="Open run on GitHub">
          <FontAwesomeIcon icon="arrow-up-right-from-square" />
        </a>
      ),
      enableSorting: false,
    },
  ], [selected, allSelected, approvable.length, isApproving]);

  if (!selectedRepositories || selectedRepositories.length === 0) {
    return <NoRepositories />;
  }

  if (isError) {
    console.error("Error fetching deployment gates:", error);
    return <p>Error loading deployment gates.</p>;
  }

  return (
    <article className="gates">
      <h2>Deployment Gates</h2>

      <div className="controls">
        <div className="actions">
          <button className="btn btn-primary" onClick={handleApprove} disabled={selected.size === 0 || isApproving}>
            {isApproving ? "Approving..." : "Approve Selected"}
          </button>
        </div>
      </div>

      {alerts.map((result, i) => (
        <Alert
          key={`${result.repositoryOwner}/${result.repositoryName}:${result.workflowRunId}:${result.environmentName}:${i}`}
          variant="danger"
          dismissible
          onClose={() => setAlerts((prev) => prev.filter((a) => a !== result))}
        >
          {result.repositoryOwner}/{result.repositoryName} · {result.environmentName}: Failed
          {result.error && <span> - {result.error}</span>}
        </Alert>
      ))}

      <DataGrid
        className="gate-table"
        data={visibleGates}
        columns={columns}
        sortable
        loading={isLoading}
        emptyMessage="No deployment gates are waiting for approval."
      />
    </article>
  );
};
```

- [ ] **Step 3: Create `css/components/gates.css`**

```css
@scope (.gates) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;

    h2 {
        font-size: 1.3rem;
        margin: 0;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        justify-content: flex-end;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex: 0 0 auto;
    }

    .gate-open-link {
        color: rgba(255, 255, 255, 0.45);
        transition: color 0.15s;

        &:hover {
            color: var(--primary);
        }
    }

    .badge.gate-environment {
        --badge-font-size: 0.72rem;
        --badge-padding-y: 0.1rem;
        --badge-padding-x: 0.5rem;
    }
}
```

- [ ] **Step 4: Register the stylesheet**

In `src/Wrangler.App/src/css/components.css`, add this line alongside the other component imports (e.g. after the `attention.css` import):

```css
@import "./components/gates.css";
```

- [ ] **Step 5: Build to verify**

Run: `cd src/Wrangler.App && npm run build`
Expected: build succeeds; `routeTree.gen.ts` now references the `/gates` route.

- [ ] **Step 6: Commit**

```bash
git add src/Wrangler.App/src/routes/gates.tsx src/Wrangler.App/src/routes/gates/-components src/Wrangler.App/src/css/components/gates.css src/Wrangler.App/src/css/components.css
git commit -m "Add deployment gates page (#142)"
```

---

### Task 8: Navigation entry

**Files:**
- Modify: `src/Wrangler.App/src/main.tsx` (register the `faShieldHalved` icon)
- Modify: `src/Wrangler.App/src/layout/Layout.tsx` (add the nav link)

**Interfaces:**
- Consumes: the `/gates` route (Task 7); the moo-ds `Icon` (already imported in `Layout.tsx`).
- Produces: a top-nav link to `/gates`.

- [ ] **Step 1: Register the gate icon in `main.tsx`**

Update the FontAwesome import to include `faShieldHalved`:

```ts
import { faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
```

And add it to the `library.add(...)` call:

```ts
library.add(faArrowUpRightFromSquare, faBarsStaggered, faChevronRight, faListUl, faLongArrowDown, faLongArrowUp, faShieldHalved, faTimesCircle);
```

- [ ] **Step 2: Add the nav link in `Layout.tsx`**

In the `top-nav` `<ul>`, add a new `<li>` immediately after the pull-requests item (`<li><Link to="/pull-requests">...`):

```tsx
              <li><Link to="/gates" title="Deployment gates"><Icon icon="shield-halved" /></Link></li>
```

- [ ] **Step 3: Build to verify**

Run: `cd src/Wrangler.App && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/Wrangler.App/src/main.tsx src/Wrangler.App/src/layout/Layout.tsx
git commit -m "Add Deployment Gates nav link (#142)"
```

---

### Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Backend build + tests**

Run: `cd src/Wrangler.Api && dotnet build` then `cd ../.. && dotnet test tests/Wrangler.Tests/Wrangler.Tests.csproj`
Expected: build succeeds; all tests pass (including `GateReviewPlannerTests`).

- [ ] **Step 2: Frontend build**

Run: `cd src/Wrangler.App && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manual smoke test**

With a repository that has an environment protection rule and a run currently awaiting approval (and that repo selected in Wrangler):
1. Open the **Deployment Gates** page via the shield nav icon.
2. Confirm the waiting run appears with its environment, branch, and run number; gates you cannot approve have a disabled checkbox.
3. Select an approvable gate and click **Approve Selected**.
4. Confirm a success toast, the row disappearing after refetch, and on github.com the run resuming.
5. Verify the empty state ("No deployment gates are waiting for approval.") shows when nothing is waiting, and `NoRepositories` shows when no repos are selected.

- [ ] **Step 4: Final review against the spec**

Re-read `docs/superpowers/specs/2026-06-20-deployment-gates-design.md` and confirm each section is implemented. No commit needed if all prior tasks committed cleanly.

---

## Notes for the implementer

- **Octokit `Connection.Get` null args:** if overload resolution is ambiguous, cast: `gitHubClient.Connection.Get<PendingDeploymentResponse[]>(uri, (IDictionary<string, string>?)null, (string?)null, cancellationToken)`.
- **Generated names:** `postGates`/`postGatesApprove` follow the existing `post<Path>` convention (cf. `postAttention`, `postPullRequestsApprove`). If the generator names a type unexpectedly, prefer fixing the import over editing generated files.
- **No reject / no comment** in v1 by design — the review call passes `PendingDeploymentReviewState.Approved` and an empty comment.
