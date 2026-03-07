using GitHubActionsDashboard.Api.Models;
using GitHubActionsDashboard.Api.Models.Dashboard;
using Octokit;

namespace GitHubActionsDashboard.Tests;

public class WorkflowRunRagStatusTests
{
    private static WorkflowRunModel CreateRun(StringEnum<WorkflowRunConclusion>? conclusion) => new()
    {
        Id = 1,
        WorkflowId = 1,
        NodeId = "node1",
        Conclusion = conclusion,
        HeadBranch = "main",
        Event = "push",
        RunNumber = 1,
        Status = new StringEnum<WorkflowRunStatus>(WorkflowRunStatus.Completed),
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
        HtmlUrl = "https://github.com",
    };

    [Theory]
    [InlineData(WorkflowRunConclusion.Failure)]
    [InlineData(WorkflowRunConclusion.StartupFailure)]
    [InlineData(WorkflowRunConclusion.TimedOut)]
    public void Red_Conclusions(WorkflowRunConclusion conclusion)
    {
        var run = CreateRun(new StringEnum<WorkflowRunConclusion>(conclusion));
        Assert.Equal(RagStatus.Red, run.RagStatus);
    }

    [Theory]
    [InlineData(WorkflowRunConclusion.ActionRequired)]
    [InlineData(WorkflowRunConclusion.Cancelled)]
    [InlineData(WorkflowRunConclusion.Skipped)]
    public void Amber_Conclusions(WorkflowRunConclusion conclusion)
    {
        var run = CreateRun(new StringEnum<WorkflowRunConclusion>(conclusion));
        Assert.Equal(RagStatus.Amber, run.RagStatus);
    }

    [Fact]
    public void Success_IsGreen()
    {
        var run = CreateRun(new StringEnum<WorkflowRunConclusion>(WorkflowRunConclusion.Success));
        Assert.Equal(RagStatus.Green, run.RagStatus);
    }

    [Fact]
    public void NullConclusion_IsNone()
    {
        var run = CreateRun(null);
        Assert.Equal(RagStatus.None, run.RagStatus);
    }
}
