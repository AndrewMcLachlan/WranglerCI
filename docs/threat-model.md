# Threat Model: GitHub Actions Dashboard

**Date:** 2026-03-07
**Version:** 1.0
**Scope:** Authentication flow, session management, API security, frontend security

---

## 1. System Overview

GitHub Actions Dashboard (GAD) is a web application for monitoring GitHub Actions workflows, repositories, and pull requests. Users authenticate via GitHub OAuth2 to grant the app access to their repositories.

### Architecture

```
[Browser] --(HTTPS/cookies)--> [ASP.NET Core API] --(OAuth token)--> [GitHub API]
                                      |
                                 [Redis / Memory]
                                 (session store)
```

### Authentication Flow

1. User navigates to `/login/github`
2. Backend generates a random `state` parameter, stores it in session, redirects to GitHub's OAuth authorize endpoint
3. GitHub redirects back to `/callback/github` with `code` and `state`
4. Backend validates `state`, exchanges `code` + `client_secret` for an access token server-side
5. Access token is stored in server-side session (never exposed to the browser)
6. A session cookie (`.GitHub.Session`) is set on the browser

### Key Security Properties

| Property | Value |
|---|---|
| Cookie name | `.GitHub.Session` |
| HttpOnly | Yes |
| Secure | Always (HTTPS required) |
| SameSite | Lax |
| Session idle timeout | 7 days |
| Session store | Redis (production) / In-memory (dev) |
| Token storage | Server-side session only |
| OAuth scopes | `read:user repo` |

---

## 2. Trust Boundaries

| # | Boundary | Description |
|---|---|---|
| TB-1 | Browser <-> API | Session cookie crosses this boundary; no access tokens cross it |
| TB-2 | API <-> GitHub | User's OAuth access token crosses this boundary |
| TB-3 | API <-> Redis | Session data (including access tokens) crosses this boundary |
| TB-4 | User <-> GitHub OAuth | User grants consent to the app at GitHub |

---

## 3. Assets

| ID | Asset | Sensitivity | Location |
|---|---|---|---|
| A-1 | GitHub OAuth access token | **Critical** | Server-side session (Redis/memory) |
| A-2 | Session cookie | **High** | Browser cookie jar |
| A-3 | Client secret | **Critical** | Server config (appsettings / env) |
| A-4 | User's GitHub identity | Medium | Server-side session |
| A-5 | Repository/workflow data | Medium | API responses, Octokit cache |

---

## 4. Threat Analysis (STRIDE)

### 4.1 Spoofing

#### T-1: OAuth State Fixation / CSRF on Login (Medium)

**Description:** An attacker crafts a login URL with their own OAuth code to force a victim into the attacker's GitHub session ("login CSRF").

**Current mitigations:**
- `state` parameter validated in `CallbackHandler.cs:38-44`
- Fresh `state` generated per login request (`Guid.NewGuid()`)

**Residual risk:** Low. Standard OAuth state validation is in place.

**Finding:** The retry logic at `CallbackHandler.cs:42-43` re-initiates the login flow if state doesn't match, which is acceptable -- it generates a new state and restarts cleanly rather than bypassing validation.

#### T-2: Session Hijacking via Cookie Theft (High)

**Description:** If the session cookie is intercepted, an attacker gains full access to the victim's GitHub data and can perform actions (approve/merge PRs) as the victim.

**Current mitigations:**
- `HttpOnly = true` prevents JavaScript access (XSS cookie theft)
- `SecurePolicy = Always` prevents transmission over HTTP
- `SameSite = Lax` prevents cross-site request attachment for non-navigation requests

**Residual risk:** Low under normal operation. Cookie theft would require a network-level MITM attack against HTTPS or a browser vulnerability.

### 4.2 Tampering

#### T-3: Request Parameter Manipulation (Low)

**Description:** API request models (`PullRequestsRequest`, `CrossRepositoryRequest`) have no input length validation. An attacker could submit excessively large payloads.

**Current mitigations:**
- ASP.NET Core has default request body size limits (30 MB)
- GitHub API enforces its own authorization -- users can only affect repos they have access to

**Recommendation:** Add `[MaxLength]` attributes or request size limits appropriate to the domain (e.g., max 100 repos per request).

### 4.3 Repudiation

#### T-4: No Audit Log for Destructive Actions (Medium)

**Description:** The approve-and-merge flow (`PullRequestService.ApproveAndMergeAsync`) performs irreversible actions (approving and merging PRs) with no application-level audit logging.

**Current mitigations:**
- GitHub's own audit log records these actions
- Standard ASP.NET request logging captures requests

**Recommendation:** Add explicit logging when approve/merge actions are performed, including the authenticated user and target PR.

### 4.4 Information Disclosure

#### T-5: Exception Details Leaked in Production Error Responses (Medium)

**Description:** Problem details always include `exceptionType` and `exceptionMessage` (`Program.cs:142-143`). While stack traces are dev-only, exception type names and messages are returned in all environments. These can reveal internal implementation details (class names, library versions, connection errors).

**Recommendation:** Only include `exceptionType` and `exceptionMessage` in development. In production, return generic error messages.

#### T-6: OpenAPI Specification Publicly Accessible (Low)

**Description:** `app.MapOpenApi()` exposes the full API schema without authentication. This aids reconnaissance but is common practice.

**Recommendation:** Acceptable risk for most deployments. Consider restricting to authenticated users if the API surface is sensitive.

### 4.5 Denial of Service

#### T-7: No Application-Level Rate Limiting (Medium)

**Description:** There is no rate limiting middleware on the ASP.NET side. An attacker could flood the API, exhausting the user's GitHub API rate limit (5,000 requests/hour for OAuth tokens) or Redis connections.

**Current mitigations:**
- GitHub API rate limits and retry-after handling in `GitHubService.cs`
- Semaphore gates (max 8 concurrent GitHub calls per service)

**Recommendation:** Add ASP.NET `UseRateLimiter()` middleware with per-session or per-IP limits, especially on the approve/merge endpoint.

#### T-8: Long Session Idle Timeout (Low)

**Description:** Sessions remain valid for 7 days of inactivity. If a user's machine is compromised, the attacker has a wide window to exploit the session.

**Recommendation:** Consider reducing to 24 hours, or adding a sliding expiration with a hard maximum lifetime (e.g., 30 days absolute).

### 4.6 Elevation of Privilege

#### T-9: Token Permissions (Low)

**Description:** The app is a GitHub App using OAuth user-to-server tokens. The app's permissions are declared in the GitHub App configuration and enforced by GitHub regardless of the OAuth scope string. The user can never exceed their own GitHub permissions, and the app further constrains access to only the declared permissions.

**Declared GitHub App permissions:**
- Actions (Read)
- Contents (Read/Write)
- Deployments (Read)
- Environments (Read)
- Checks (Read)
- Commit Statuses (Read)
- Pull Requests (Read/Write)
- Workflows (Read/Write)

**Residual risk:** Low. Permissions are fine-grained and appropriate for the app's functionality.

---

## 5. Configuration Findings

### C-1: `AllowedHosts: "*"` (Medium)

**File:** `appsettings.json`

The host filtering middleware accepts requests with any `Host` header. This can enable host header injection attacks in some reverse proxy configurations.

**Recommendation:** Set `AllowedHosts` to the specific production domain(s).

### C-2: Secure Cookie Prevents Local Development on HTTP (Info)

The `CookieSecurePolicy.Always` setting means the session cookie is never sent over HTTP. The `http` launch profile (port 5010) cannot create valid sessions. Development requires either the `https` profile or the Vite proxy (which operates same-origin from the browser's perspective, though the backend still sees HTTP).

**Note:** This is documented in MEMORY.md and is a known trade-off. The Vite proxy approach works because the browser sees `https://localhost:3010` (or just `http://localhost:3010` with the cookie domain matching), while the actual backend is on HTTP behind the proxy. However, session cookies may still not be set if the browser enforces Secure cookie policy strictly. Verify this works in current browser versions.

---

## 6. Summary of Recommendations

| Priority | Finding | Recommendation |
|---|---|---|
| **Medium** | T-4: No audit logging for merges | Log approve/merge actions with user context |
| **Medium** | T-5: Exception details in production | Restrict exception info to development |
| **Medium** | T-7: No rate limiting | Add `UseRateLimiter()` middleware |
| **Medium** | C-1: AllowedHosts wildcard | Restrict to production domain(s) |
| **Low** | T-3: No input validation limits | Add max-length/max-count constraints to request models |
| **Low** | T-8: 7-day session timeout | Consider reducing, add absolute expiry |

---

## 7. Positive Security Observations

The following are well-implemented security controls:

1. **Access tokens never reach the browser.** The OAuth code exchange happens server-side, and the token is stored only in the server-side session. The browser only receives a session cookie.
2. **HttpOnly + Secure + SameSite cookies.** The session cookie has all three protective flags set correctly.
3. **State parameter for OAuth CSRF.** The login flow generates a cryptographically random state value and validates it on callback.
4. **Server-side session store.** Using Redis (production) / in-memory (dev) rather than client-side JWT or localStorage means tokens can be revoked by clearing the session store.
5. **Security headers middleware.** `UseSecurityHeaders()` from the Asm library adds standard protective headers.
6. **GitHub API retry and rate limit handling.** The `GitHubService` base class properly handles rate limits, abuse detection, and exponential backoff.
7. **Scoped GitHubClient per request.** Each request gets its own `IGitHubClient` from the session token, preventing cross-user data leakage.
8. **Antiforgery tokens on state-changing endpoints.** The approve/merge endpoint requires a valid antiforgery token, providing defence-in-depth against CSRF beyond `SameSite` cookies.
