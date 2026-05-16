namespace Asm.Wrangler.Api.Webhooks;

/// <summary>
/// Categories of GitHub data tracked by the version sidecar.
/// Each category has its own version stamp per (owner, repo).
/// </summary>
public enum RepoDataKind
{
    Workflows,
    WorkflowRuns,
    Pulls,
    Checks,
}
