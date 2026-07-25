# Postie CQRS Adoption — Design

**Date:** 2026-07-24
**Status:** Approved (design sections reviewed in brainstorming session)
**Scope:** `src/Wrangler.Api` (ASP.NET Core Minimal API, net10). No frontend behaviour change; the generated frontend client must regenerate to an empty diff.

## Goal

Adopt Postie (the project author's CQRS-for-Minimal-API library, NuGet, v1.0.1)
across all `/api` data endpoints in Wrangler.Api, using Postie's own mediator.
Requests become `IQuery`/`ICommand`, thin Postie handlers replace the static
`*Handler.Handle` adapters, and the manual `api.Map*(…, Handler.Handle)` block
becomes Postie's `MapQuery`/`MapCommand` conventions. The existing service
layer and all runtime behaviour are preserved.

## Decisions (from brainstorming)

- **Full migration** of all ~12 `/api` data endpoints in one spec.
- **Postie's own mediator** — `Postie.Cqrs.AspNetCore` (dogfoods the author's
  full stack, no extra dependency).
- **Keep the service layer.** Each Postie handler is thin and calls the
  existing `I*Service`; the `GitHubService` retry/caching base and the
  services' tested logic are untouched. Only the static `*Handler` adapter
  classes are removed.
- **No FluentValidation** — none exists today; out of scope (YAGNI).

## 1. Request + handler shape

Request records keep their **existing names** (so OpenAPI schema component
names — and therefore the generated frontend types — do not change); they gain
only the CQRS marker interface:

```csharp
// Requests/WorkflowsRequest.cs — name unchanged, marker added
public record WorkflowsRequest : BranchFilterRequest, IQuery<IEnumerable<RepositoryModel>>
{
    public IEnumerable<RepositoryWorkflowRequest> Repositories { get; init; } = [];
}

// Handlers/WorkflowsQueryHandler.cs — replaces static WorkflowsHandler; thin, calls the service
public class WorkflowsQueryHandler(IDashboardService service)
    : IQueryHandler<WorkflowsRequest, IEnumerable<RepositoryModel>>
{
    public ValueTask<IEnumerable<RepositoryModel>> Handle(WorkflowsRequest query, CancellationToken ct)
        => new(service.GetWorkflowsAsync(query, ct));
}
```

Rules:
- One `IQueryHandler`/`ICommandHandler` per request record.
- Handlers stay thin: bind → delegate to `I*Service` → return. No logic moves
  into handlers.
- `ValueTask` wraps the services' existing `Task` returns.
- Commands with no response body implement `ICommand` and
  `ICommandHandler<TCommand>`.
- `builder.Services.AddPostie(typeof(WorkflowsRequest).Assembly)` discovers all
  handlers by assembly scan.

The static `*Handler` classes in `Handlers/` for `/api` data endpoints are
deleted once their Postie handler exists. (The non-CQRS handlers below stay.)

## 2. Endpoint mapping

In `Program.cs`'s `AddApp`, the `/api` `MapGet`/`MapPost` block is replaced with
Postie conventions. **Routes, verbs, and `DisableAntiforgery()` are preserved
exactly.** Most `/api` POSTs are *reads* that carry a repository list in the
body — they map as `MapQuery` over POST, not commands. Only the two `/approve`
endpoints mutate.

| Current route / verb | Postie mapping | Kind |
|---|---|---|
| `GET me` | `MapQuery<…>` | query |
| `GET repositories` | `MapQuery<…>` | query |
| `GET repositories/grouped` | `MapQuery<…>` | query |
| `GET users/search` | `MapQuery<…>` (query-string bound) | query |
| `POST workflows` | `MapQuery<WorkflowsRequest, IEnumerable<RepositoryModel>>` (POST + body) | query |
| `POST repositories/{owner}/{repo}/workflows/` | `MapQuery<…>` (route + body) | query |
| `POST repositories/{owner}/{repo}/workflows/{workflowId}/runs` | `MapQuery<WorkflowRunsRequest, …>` (route + body) | query |
| `POST pull-requests` | `MapQuery<PullRequestsRequest, …>` (POST + body) | query |
| `POST attention` | `MapQuery<AttentionRequest, …>` (POST + body) | query |
| `POST gates` | `MapQuery<GatesRequest, …>` (POST + body) | query |
| `POST pull-requests/approve` | `MapCommand<ApprovePullRequestsRequest, …>` | command |
| `POST gates/approve` | `MapCommand<ApproveGatesRequest, …>` | command |

Body-only queries keep the default body binding; the body-POST reads keep
`DisableAntiforgery()`.

**Binding uncertainty to resolve in planning:** the two
`repositories/{owner}/{repo}/…` endpoints are POST queries that bind **both**
route params *and* a body. Postie's documented query binding is route/query
(body for POST/QUERY); whether `MapQuery` expresses a simultaneous route-param
+ body bind must be confirmed against Postie before implementing these two.
The plan must verify this first and, if `MapQuery` cannot express it, fall back
(e.g. carry the route values in the body, or leave just these two as raw
minimal API) — without changing their route, verb, or schema, so the
frontend-client invariant (Section 3) holds regardless.

Some `/api` GETs currently return Octokit types directly (e.g. `me`,
`repositories` returning `Repository`). These map unchanged; Postie's
404-on-null applies to single-object queries (never null here) and collection
queries return empty, not null.

## 3. OpenAPI & frontend-client compatibility (the primary constraint)

The frontend regenerates its client from `src/Wrangler.Api/openapi-v1.json`
(built via `OpenApiGenerateDocuments`), and hey-api derives function names
(`postWorkflows`, `postAttention`, …) from **method + path** — only one
endpoint sets an explicit `operationId` today. The migration must keep the
emitted OpenAPI document equivalent so the client regenerates unchanged.

Held invariant by design:
- Routes, verbs, request schemas (record names unchanged → component `$ref`
  names unchanged), and response schemas are identical.
- No new `operationId`s that would rename client functions. If Postie's
  conventions emit operationIds, pin them with `.WithName(...)` to the current
  names, or confirm hey-api still derives the same names.
- The one *additive* change Postie introduces: reference-returning queries
  advertise a documented **404** response. This is additive metadata and does
  not change runtime behaviour (collection queries return empty, not null).

**Verification gate (applied at the end, and after each vertical slice):**
1. `cd src/Wrangler.Api && dotnet build` → regenerates `openapi-v1.json`.
2. `git diff src/Wrangler.Api/openapi-v1.json` → expect only additive `404`
   responses; **no** path, verb, schema, or operation-name changes.
3. `cd src/Wrangler.App && npm run generate` → `git diff src/api/` must be
   **empty**.
4. `npm test && npm run lint && npm run build` (frontend) stay green.

If step 3 is not empty, the mapping is not yet faithful — fix before continuing.

## 4. Scope boundary, packages, wiring, testing

**Untouched — stay raw minimal API** (not CQRS): `GET callback/github`,
`GET login/github`, `POST logout`, `GET events/stream` (SSE),
`GET admin/session/debug`, and the Octokit webhook pipeline
(`GitHubWebhookEventProcessor`). Their static handlers remain.

**Packages / wiring:**
- Add `Postie.Cqrs.AspNetCore` (v1.0.1) as a direct `PackageReference` in
  `Wrangler.Api.csproj` (no central package management in this repo).
- `builder.Services.AddPostie(typeof(WorkflowsRequest).Assembly)` in
  `AddServices`.
- Replace the `/api` `Map*` block in `AddApp` with the Section 2 conventions;
  keep the `app.MapGroup(ApiPrefix)` group and the non-CQRS mappings.
- Existing exception→problem-details handling and JSON options are unchanged.

**Testing:**
- Existing `Wrangler.Tests` unit tests (status derivation, branch filter, gate
  planner, installation registry, form parsing) cover pure logic and keep
  passing untouched — services are unchanged.
- No endpoint/integration tests exist today; the routing/binding safety net is
  the OpenAPI-diff + frontend-client-regen gate (Section 3) plus `dotnet build`.
- Add one minimal startup smoke test: the host builds, `AddPostie` resolves an
  `IQueryHandler`/`ICommandHandler` for every request type, and the expected
  `/api` routes are present in the endpoint data source. This catches a missing
  handler registration or an unmapped request at test time rather than runtime.

## Out of scope

- FluentValidation / request validation pipeline behaviours.
- Migrating non-CQRS endpoints (auth, SSE, webhooks, admin).
- Collapsing service logic into handlers (services stay as the logic layer).
- Any frontend change beyond a verified no-op client regeneration.
- MediatR (Postie's own mediator is used).
