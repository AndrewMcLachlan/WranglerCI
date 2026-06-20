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
