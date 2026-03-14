# Wrangler CI

A dashboard for monitoring GitHub Actions workflows and pull requests across multiple repositories.

Wrangler CI gives you at-a-glance visibility into your CI/CD pipelines. It aggregates workflow run statuses into RAG (Red/Amber/Green) indicators per repository and workflow, so you can quickly spot failures without clicking through GitHub. It also surfaces open pull requests with their check statuses, and lets you approve and merge them from a single interface.

## Features

- **Workflow monitoring** — View GitHub Actions workflow runs across all your repositories with colour-coded status indicators (success, failure, running, waiting, action required)
- **Multiple view modes** — Switch between card, nested list, and flat list layouts
- **Pull request management** — See open PRs with check statuses, approve and merge from the dashboard
- **Repository and workflow filtering** — Select which repositories and workflows to track
- **GitHub OAuth login** — Authenticate with your GitHub account; sessions are managed server-side

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | .NET 10 / ASP.NET Core minimal API |
| Frontend | React 19, TypeScript, Vite |
| Routing | TanStack Router (file-based) |
| Data fetching | TanStack React Query |
| GitHub API | Octokit (REST + GraphQL) |
| Auth | GitHub OAuth 2.0 |
| Caching | Redis (production) / in-memory (development) |

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 22+](https://nodejs.org/)
- A GitHub account
- A GitHub personal access token (classic) with `read:packages` scope — required to restore packages from GitHub Packages (see [Package registry setup](#package-registry-setup))

## Getting Started

### 1. Package registry setup

Both the backend (NuGet) and frontend (npm) depend on packages hosted on GitHub Packages. GitHub Packages requires authentication even for public packages.

**npm** — Create or update `~/.npmrc` (your user-level npmrc, not the one in this repo):

```
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

**NuGet** — Add credentials for the GitHub source. The repo already includes a `NuGet.config` that registers the feed; you just need to supply credentials:

```bash
dotnet nuget update source GitHub \
  --username YOUR_GITHUB_USERNAME \
  --password YOUR_GITHUB_TOKEN \
  --store-password-in-clear-text
```

> Your token needs the `read:packages` scope. You can create one at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

### 2. GitHub OAuth App

Wrangler CI uses GitHub OAuth for authentication. For local development, the `ClientId` in `appsettings.json` points to an existing GitHub App. You need to configure the client secret:

```bash
cd src/Wrangler.Api
dotnet user-secrets set "ClientSecret" "YOUR_CLIENT_SECRET"
```

If you're setting up your own GitHub App, create one at [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps) with:
- **Callback URL:** `http://localhost:3010/callback/github`
- **Permissions:** Actions (Read), Contents (Read/Write), Pull Requests (Read/Write), Checks (Read), Commit Statuses (Read)

Then update `ClientId` and `RedirectUri` in `appsettings.json` and set your client secret via user-secrets as above.

### 3. Install dependencies

```bash
# Frontend
cd src/Wrangler.App
npm install

# Backend
cd src/Wrangler.Api
dotnet restore
```

### 4. Run the app

The easiest way is to start the backend with the SPA proxy, which also launches the Vite dev server:

```bash
cd src/Wrangler.Api
dotnet run --launch-profile http
```

This starts:
- **Backend API** on `http://localhost:5010`
- **Frontend dev server** on `http://localhost:3010` (via SPA proxy)

Open `http://localhost:3010` in your browser.

Alternatively, run them separately:

```bash
# Terminal 1 — Backend
cd src/Wrangler.Api
dotnet run --launch-profile "API Only"

# Terminal 2 — Frontend
cd src/Wrangler.App
npm run dev
```

## API Client Generation

The frontend API client (`src/Wrangler.App/src/api/`) is auto-generated from the backend's OpenAPI spec. Do not edit these files manually.

To regenerate after backend changes:

1. Start the backend on `http://localhost:5010`:
   ```bash
   cd src/Wrangler.Api && dotnet run --launch-profile http
   ```
2. In a separate terminal:
   ```bash
   cd src/Wrangler.App && npm run generate
   ```
3. Stop the backend.

## Project Structure

```
src/
├── Wrangler.Api/          # .NET backend (ASP.NET Core minimal API)
│   ├── Handlers/          # Request handlers (static classes with Handle method)
│   ├── Services/          # GitHub API integration services
│   └── Models/            # Domain models
└── Wrangler.App/          # React frontend (Vite + TanStack Router)
    ├── src/
    │   ├── api/           # Auto-generated API client (do not edit)
    │   ├── routes/        # File-based routes (TanStack Router)
    │   └── components/    # Shared components
    └── public/
```

## License

[Apache License 2.0](LICENSE)
