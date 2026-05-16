# GitHub Webhook Support — Wrangler CI Issue #93

## Context

Wrangler currently polls the GitHub REST API every 2 minutes (workflow runs, pull requests) to keep the dashboard fresh. This burns API rate-limit budget and adds up to 2 minutes of UI latency after any change. Issue #93 asks for webhook delivery so the app can react to changes immediately and only re-fetch what actually changed.

**User-confirmed direction:**
- The GitHub registration on github.com is already a **GitHub App** (client ID `Iv23liIR4LMmkRTEwtiN`; `CallbackHandler.cs:28-30` already detects `installation_id`).
- Frontend updates via **SSE push** in real time (the `@hey-api/openapi-ts` generator already scaffolds an SSE client at `src/api/core/serverSentEvents.gen.ts`, currently unused).
- MVP events: `workflow_run`, `pull_request`, `check_run`, `check_suite`.

Plan is split into four phases so each can ship independently as its own PR.

---

## Phase 1 — Receive & verify webhooks (no UX changes)

Deployable baseline: webhooks arrive, signature is verified, deliveries are deduped, but caches stay TTL-driven.

**Packages** (modify `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Wrangler.Api.csproj`):
- `Octokit.Webhooks.AspNetCore` — typed event processor + minimal-API mapping with built-in HMAC verification.
- `GitHubJwt` — only needed once we call GitHub as the App. Defer to Phase 4.

**Configuration** (binds via `IOptions<GitHubAppOptions>` — new POCO at `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Models\GitHubAppOptions.cs`):

| Key                          | Dev source     | Prod source             |
|------------------------------|----------------|-------------------------|
| `GitHubApp:AppId`            | user-secrets   | App Service config      |
| `GitHubApp:ClientId`         | appsettings    | App Service config      |
| `GitHubApp:WebhookSecret`    | user-secrets   | KeyVault                |
| `GitHubApp:PrivateKeyPem`    | user-secrets   | KeyVault (Phase 4 only) |

**New files:**
- `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Models\GitHubAppOptions.cs`
- `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Webhooks\GitHubWebhookEventProcessor.cs` — derives from `Octokit.Webhooks.WebhookEventProcessor`. Overrides:
  `ProcessWorkflowRunWebhookAsync`, `ProcessPullRequestWebhookAsync`,
  `ProcessCheckRunWebhookAsync`, `ProcessCheckSuiteWebhookAsync`,
  `ProcessInstallationWebhookAsync`, `ProcessInstallationRepositoriesWebhookAsync`.
  Phase 1: log + idempotency-dedupe only.
- `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Services\IInstallationRegistry.cs` + `InstallationRegistry.cs` — Redis-backed.

**Installation registry — Redis key shape** (no TTL):
- `gh:install:{installationId}` → hash `{ account, accountId, type, suspendedAt? }`
- `gh:install:{installationId}:repos` → set of `"<owner>/<repo>"`
- `gh:repo:{owner}/{repo}:install` → string `installationId` (reverse lookup, used by Phase 2/3)

**Idempotency:** `gh:delivery:{X-GitHub-Delivery}` → 1 byte, 10-min TTL. Processor checks-and-sets before doing work.

**Modify `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Program.cs`:**
- Register `WebhookEventProcessor` as singleton.
- Bind `GitHubAppOptions`.
- Call `app.MapGitHubWebhooks("/webhooks/github", options.WebhookSecret)` **outside** the `/api` group, with `.AllowAnonymous().ExcludeFromDescription()`.

**Operational setup:**
- Configure the GitHub App's webhook URL to `https://githubactionsdashboard.azurewebsites.net/webhooks/github`.
- For local dev, document `smee.io` or `ngrok` and a `GitHubApp:WebhookUrl` user-secret override in the README.

**Granular tasks:**
1. Add packages + `GitHubAppOptions` binding.
2. `InstallationRegistry` + tests (Redis hash/set ops).
3. `GitHubWebhookEventProcessor` with idempotency only.
4. Wire `MapGitHubWebhooks` in `Program.cs`.
5. Configure App webhook URL; confirm 200s via App → Advanced → Recent Deliveries.
6. Implement installation-lifecycle handlers (created / deleted / suspend / `installation_repositories` added / removed).
7. Implement MVP event handlers as log-only.

---

## Phase 2 — Cache invalidation via per-repo data-version sidecar

**Key challenge:** the Octokit response cache is keyed per-user (token-hash prefix from `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Services\CacheKeyService.cs`), but webhooks fire app-wide with no user context. We need invalidation that works without a user token.

**Approach: data-version sidecar** (least invasive — no changes to per-user keying):
- `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Services\IRepoVersionService.cs` + `RepoVersionService.cs` (new) — Redis `INCR` per `(owner, repo, kind)`:
  - Key: `gh:ver:{owner}/{repo}:{kind}`, where `kind ∈ { workflows, workflow_runs, pulls, checks }`.
  - `GetVersion(...)` returns the current counter (0 if absent).
  - `Bump(...)` does `INCR`.
- Modify `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Services\DistributedResponseCache.cs` (`GetCacheKey` at line 70): derive `(owner, repo, kind)` from `request.Endpoint`, look up the current version, append `:v{n}` to the key. Both `GetAsync` and `SetAsync` use this same builder, so versioning is symmetric. Endpoints that don't map (e.g., `/user/repos`) get no suffix and behave as today.
- Endpoint → kind mapping (table-driven, unit-tested in isolation):
  - `/repos/{o}/{r}/actions/workflows` → `workflows`
  - `/repos/{o}/{r}/actions/workflows/{id}/runs` or `/repos/{o}/{r}/actions/runs` → `workflow_runs`
  - `/repos/{o}/{r}/pulls...` → `pulls`
  - `/repos/{o}/{r}/check-runs...` and `/check-suites...` → `checks`

**Event → bump map** (in `GitHubWebhookEventProcessor`):

| Event                         | Bumps                          |
|-------------------------------|--------------------------------|
| `workflow_run`                | `workflow_runs`, `workflows`   |
| `check_run` / `check_suite`   | `checks`, `workflow_runs`      |
| `pull_request` (open/close/sync/reopen/edit/ready_for_review) | `pulls` |

Ignore noisy `pull_request` actions: `labeled`, `unlabeled`, `assigned`, `review_requested` (none change check status surfaced in our UI).

**Granular tasks:**
1. `RepoVersionService` + tests.
2. Endpoint-→-kind mapper (most error-prone bit; corpus of real `IRequest.Endpoint` values captured from a debug session).
3. Plumb mapper into `DistributedResponseCache.GetCacheKey`.
4. Wire `Bump` calls into the four event handlers.
5. Manual verify: trigger a run, observe Redis `INCR`, observe next API call returns fresh data.

After Phase 2 → polling still runs at 2 min, but each poll-cycle sees fresh data within one bump.

---

## Phase 3 — Real-time push via SSE

**Backend:**
- New: `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Models\GitHubEvent.cs` — `{ Type, Owner, Repo, WorkflowId?, RunId?, PullRequestNumber?, DeliveryId }`.
- New: `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Services\IEventBroadcaster.cs` + `EventBroadcaster.cs` — singleton holding `ConcurrentDictionary<Guid, Channel<GitHubEvent>>` (bounded `Channel<T>` capacity ~64, drop-oldest). `Publish` fans out non-blocking writes. `Subscribe()` → `(Guid, ChannelReader<GitHubEvent>)`.
- New: `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Handlers\EventStreamHandler.cs` — minimal-API handler. Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. Loop reads from channel + emits `: keepalive\n\n` every 25 s. Honours `HttpContext.RequestAborted`. `Response.Body.FlushAsync()` after each frame.
- Modify `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Program.cs`: `api.MapGet("events/stream", EventStreamHandler.Handle)` — inside `/api` group so existing session cookie auth applies.
- Wire `EventBroadcaster.Publish` into each webhook handler right after the Phase 2 version bump.

**Filtering decision:** server pushes all events to every connected session; the frontend filters on selected repos (which live in `localStorage`). Cheaper than threading repo state through the SSE connection.

**Frontend:**
- New: `K:\Dev\Apps\Wrangler\src\Wrangler.App\src\hooks\useGitHubEventStream.ts` — opens the SSE stream once via the generated SSE helper, holds an `eventType → queryKey-prefix[]` table, calls `queryClient.invalidateQueries({ predicate })` matching on owner/repo:
  - `workflow_run` → `["getWorkflowRuns", owner, repo]`, `["getWorkflows"]`
  - `check_run`/`check_suite` → `["getWorkflowRuns", owner, repo]`, `["getWorkflows"]`
  - `pull_request` → `["pullRequests"]`
- Modify `K:\Dev\Apps\Wrangler\src\Wrangler.App\src\App.tsx` (or a thin wrapper inside `QueryClientProvider` in `main.tsx`) to mount the hook once for the authenticated layout.
- Modify `useWorkflowRuns.ts`, `useWorkflows.ts`, `usePullRequests.ts`: raise `staleTime` to `Infinity` and either drop `refetchInterval` or relax to ~10 min as a safety net.

**Granular tasks:**
1. `GitHubEvent` + `EventBroadcaster` + tests (channel cleanup on cancellation is the tricky part).
2. `EventStreamHandler` with heartbeat.
3. Wire broadcaster into `GitHubWebhookEventProcessor`.
4. Frontend `useGitHubEventStream` hook + mount.
5. Relax polling on the three hooks.
6. Verify Azure App Service (Linux) doesn't buffer the SSE response.

After Phase 3 → MVP is done. Real-time dashboard updates.

---

## Phase 4 — UX for App installation

- Modify `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Handlers\CallbackHandler.cs` (lines 28–30): when `installation_id` is present, defensively backfill the registry. Use a one-shot App-JWT call to `GET /app/installations/{id}` + `/installation/repositories`. This is where the `GitHubJwt` package and `GitHubApp:PrivateKeyPem` config are first needed. New service: `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Services\GitHubAppAuthService.cs`.
- New handler: `K:\Dev\Apps\Wrangler\src\Wrangler.Api\Handlers\InstallationStatusHandler.cs` → `GET /api/installations/status` returns, for the current user's selected repos, which `(owner, repo)` pairs are covered vs uncovered.
- New frontend component: `K:\Dev\Apps\Wrangler\src\Wrangler.App\src\routes\dashboard\-components\InstallAppBanner.tsx`. Shown when uncovered repos exist; CTA links to `https://github.com/apps/<app-slug>/installations/new`.
- GitHub App settings: confirm "Post installation Callback URL" → `https://githubactionsdashboard.azurewebsites.net/callback/github`.

**Granular tasks:**
1. `GitHubAppAuthService` (JWT signing via `GitHubJwt`).
2. Backfill on callback.
3. `/api/installations/status` endpoint.
4. Frontend banner + dismiss state.

---

## Critical files

**New:**
- `src/Wrangler.Api/Models/GitHubAppOptions.cs`
- `src/Wrangler.Api/Models/GitHubEvent.cs`
- `src/Wrangler.Api/Webhooks/GitHubWebhookEventProcessor.cs`
- `src/Wrangler.Api/Services/IInstallationRegistry.cs` + `InstallationRegistry.cs`
- `src/Wrangler.Api/Services/IRepoVersionService.cs` + `RepoVersionService.cs`
- `src/Wrangler.Api/Services/IEventBroadcaster.cs` + `EventBroadcaster.cs`
- `src/Wrangler.Api/Services/GitHubAppAuthService.cs` (Phase 4)
- `src/Wrangler.Api/Handlers/EventStreamHandler.cs`
- `src/Wrangler.Api/Handlers/InstallationStatusHandler.cs` (Phase 4)
- `src/Wrangler.App/src/hooks/useGitHubEventStream.ts`
- `src/Wrangler.App/src/routes/dashboard/-components/InstallAppBanner.tsx` (Phase 4)

**Modified:**
- `src/Wrangler.Api/Wrangler.Api.csproj` — add `Octokit.Webhooks.AspNetCore`, `GitHubJwt` (Phase 4).
- `src/Wrangler.Api/Program.cs` — DI + routes.
- `src/Wrangler.Api/Services/DistributedResponseCache.cs` — version-suffix in `GetCacheKey` (line 70).
- `src/Wrangler.Api/Handlers/CallbackHandler.cs` — replace the no-op `installation_id` branch (Phase 4).
- `src/Wrangler.App/src/App.tsx` — mount the SSE hook.
- `src/Wrangler.App/src/routes/dashboard/-hooks/useWorkflows.ts`, `useWorkflowRuns.ts`, `src/routes/pull-requests/-hooks/usePullRequests.ts` — relax polling.

**Reused (do not re-implement):**
- `Octokit.Webhooks.AspNetCore.WebhookEventProcessor` — base class + `MapGitHubWebhooks` extension; do not hand-roll HMAC.
- `src/Wrangler.App/src/api/core/serverSentEvents.gen.ts` — generated SSE client.
- `IDistributedCache` / `IConnectionMultiplexer` already wired in `Program.cs:97-124` (Redis).
- `CacheKeyService.GetCacheKey` — unchanged; we layer the version suffix inside `DistributedResponseCache` only.

---

## Verification

**Phase 1 — webhook receipt:**
1. `dotnet run --launch-profile http` against a `smee.io` tunnel pointed at `/webhooks/github`.
2. Trigger an event on a test repo (push to main, open a PR).
3. Confirm 200 on the App's Recent Deliveries page.
4. Hit a duplicate `X-GitHub-Delivery` and confirm the second request short-circuits via the idempotency log line.

**Phase 2 — cache invalidation:**
1. Hit `/api/workflows` → confirm cache key in Redis (e.g., `redis-cli KEYS '*:gh:GET:/repos/...'`).
2. Trigger a `workflow_run` event → confirm `INCR` on `gh:ver:{owner}/{repo}:workflow_runs`.
3. Hit `/api/workflows` again → confirm a fresh outbound GitHub call and a new cache entry with the bumped version suffix.

**Phase 3 — SSE push:**
1. Open the dashboard; check DevTools → Network → `/api/events/stream` shows `text/event-stream` and stays open.
2. Trigger a `workflow_run` event → observe an SSE frame in DevTools and React Query invalidating the matching key (use the React Query devtools panel).
3. Disconnect the network for 30 s, reconnect — confirm SSE re-opens via the generated client's retry logic.
4. Deploy a Phase 3 build to App Service and re-run (catches any nginx buffering).

**Phase 4 — installation UX:**
1. Uninstall the App from a test account; reload the dashboard → banner appears.
2. Click "Install" → complete GitHub install flow → land back on `/callback/github` → banner disappears and matching events start flowing.

---

## Risks / open questions

- **Endpoint-→-kind mapping fragility (Phase 2).** Octokit endpoints can carry query strings and trailing slashes. Mitigate with table-driven tests over a captured corpus of real `IRequest.Endpoint` values.
- **Delivery retries up to 24 h.** Idempotency window of 10 min is enough — duplicates beyond that just cause one extra refetch (harmless re-bump).
- **SSE behind Azure App Service (Linux).** Default reverse proxy may buffer. Mitigated via `X-Accel-Buffering: no` + per-frame `FlushAsync`. Verify after first deploy.
- **Heartbeats.** 25 s comment frames; App Service idle TCP timeout is 240 s — comfortable margin.
- **Repos not covered by any installation** keep polling. Document and surface via Phase 4 banner.
- **Octokit GraphQL responses** aren't routed through `IResponseCache` and aren't affected by this work.
- **Per-user cache vs app-wide webhook.** The version-sidecar approach side-steps the mismatch — webhooks don't need a user context to invalidate, and users still see their own cached responses (just keyed to the latest version after a bump). No need to drop token-hashing.
- **Webhook firehose volume.** A user on busy orgs may see hundreds of events/minute. Bounded channels + drop-oldest + React Query's debouncing of invalidations keep this safe for a personal-project workload.
