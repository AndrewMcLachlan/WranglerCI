namespace Asm.Wrangler.Api.Webhooks;

/// <summary>
/// Maps Octokit endpoint paths to a (owner, repo, kind) tuple so the
/// response cache can apply the matching per-repo version stamp.
/// Unmapped paths return <c>false</c> and bypass versioning.
/// </summary>
public static class EndpointKindMapper
{
    public static bool TryMap(string endpoint, out string owner, out string repo, out RepoDataKind kind)
    {
        owner = String.Empty;
        repo = String.Empty;
        kind = default;

        if (String.IsNullOrEmpty(endpoint)) return false;

        // Strip any query string — kind is determined by the path only.
        var path = endpoint;
        var queryIdx = path.IndexOf('?');
        if (queryIdx >= 0) path = path[..queryIdx];

        var segments = path.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);

        // Every supported path starts with "/repos/{owner}/{repo}/..." with
        // at least one tail segment.
        if (segments.Length < 4) return false;
        if (!String.Equals(segments[0], "repos", StringComparison.OrdinalIgnoreCase)) return false;

        owner = segments[1];
        repo = segments[2];
        var tail = segments[3];

        // Tail-based dispatch. Order matters where one prefix is a subset of
        // another (e.g. workflows vs workflows/{id}/runs).
        if (String.Equals(tail, "actions", StringComparison.OrdinalIgnoreCase))
        {
            if (segments.Length >= 5)
            {
                var sub = segments[4];
                // /repos/{o}/{r}/actions/workflows/{id}/runs → workflow_runs
                if (String.Equals(sub, "workflows", StringComparison.OrdinalIgnoreCase) && segments.Length >= 7 &&
                    String.Equals(segments[6], "runs", StringComparison.OrdinalIgnoreCase))
                {
                    kind = RepoDataKind.WorkflowRuns;
                    return true;
                }
                // /repos/{o}/{r}/actions/workflows[...] → workflows
                if (String.Equals(sub, "workflows", StringComparison.OrdinalIgnoreCase))
                {
                    kind = RepoDataKind.Workflows;
                    return true;
                }
                // /repos/{o}/{r}/actions/runs[...] → workflow_runs
                if (String.Equals(sub, "runs", StringComparison.OrdinalIgnoreCase))
                {
                    kind = RepoDataKind.WorkflowRuns;
                    return true;
                }
            }
            return false;
        }

        if (String.Equals(tail, "pulls", StringComparison.OrdinalIgnoreCase))
        {
            kind = RepoDataKind.Pulls;
            return true;
        }

        if (String.Equals(tail, "check-runs", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(tail, "check-suites", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(tail, "commits", StringComparison.OrdinalIgnoreCase))
        {
            // /repos/{o}/{r}/commits/{sha}/check-runs and /commits/{sha}/status
            // both feed the check-status surface; bucket under Checks.
            if (String.Equals(tail, "commits", StringComparison.OrdinalIgnoreCase))
            {
                if (segments.Length >= 6 &&
                    (String.Equals(segments[5], "check-runs", StringComparison.OrdinalIgnoreCase) ||
                     String.Equals(segments[5], "status", StringComparison.OrdinalIgnoreCase)))
                {
                    kind = RepoDataKind.Checks;
                    return true;
                }
                return false;
            }
            kind = RepoDataKind.Checks;
            return true;
        }

        return false;
    }
}
