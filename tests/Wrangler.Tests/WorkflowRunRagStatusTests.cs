using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Models.Dashboard;
using Octokit;

namespace Asm.Wrangler.Tests;

public class WorkflowRunWorkflowStatusTests
{
    private static WorkflowRunModel CreateRun(
        StringEnum<WorkflowRunConclusion>? conclusion,
        WorkflowRunStatus status = WorkflowRunStatus.Completed) => new()
    {
        Id = 1,
        WorkflowId = 1,
        NodeId = "node1",
        Conclusion = conclusion,
        HeadBranch = "main",
        Event = "push",
        RunNumber = 1,
        Status = new StringEnum<WorkflowRunStatus>(status),
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
        Assert.Equal(WorkflowStatus.Red, run.WorkflowStatus);
    }

    [Theory]
    [InlineData(WorkflowRunConclusion.ActionRequired)]
    [InlineData(WorkflowRunConclusion.Cancelled)]
    [InlineData(WorkflowRunConclusion.Skipped)]
    public void Amber_Conclusions(WorkflowRunConclusion conclusion)
    {
        var run = CreateRun(new StringEnum<WorkflowRunConclusion>(conclusion));
        Assert.Equal(WorkflowStatus.Amber, run.WorkflowStatus);
    }

    [Fact]
    public void Success_IsGreen()
    {
        var run = CreateRun(new StringEnum<WorkflowRunConclusion>(WorkflowRunConclusion.Success));
        Assert.Equal(WorkflowStatus.Green, run.WorkflowStatus);
    }

    [Fact]
    public void NullConclusion_Queued_IsNone()
    {
        var run = CreateRun(null, WorkflowRunStatus.Queued);
        Assert.Equal(WorkflowStatus.None, run.WorkflowStatus);
    }

    [Fact]
    public void NullConclusion_InProgress_IsRunning()
    {
        var run = CreateRun(null, WorkflowRunStatus.InProgress);
        Assert.Equal(WorkflowStatus.Running, run.WorkflowStatus);
    }

    [Fact]
    public void NullConclusion_Waiting_IsWaiting()
    {
        var run = CreateRun(null, WorkflowRunStatus.Waiting);
        Assert.Equal(WorkflowStatus.Waiting, run.WorkflowStatus);
    }
}
