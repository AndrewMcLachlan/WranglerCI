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
