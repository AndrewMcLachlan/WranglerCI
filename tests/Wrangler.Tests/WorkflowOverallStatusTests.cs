using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Models.Dashboard;
using Octokit;

namespace Asm.Wrangler.Tests;

public class WorkflowOverallStatusTests
{
    private static WorkflowRunModel CreateRun(
        WorkflowRunConclusion? conclusion,
        string branch = "main",
        DateTimeOffset? updatedAt = null,
        WorkflowRunStatus status = WorkflowRunStatus.Completed) => new()
    {
        Id = Random.Shared.Next(),
        WorkflowId = 1,
        NodeId = "node1",
        Conclusion = conclusion.HasValue ? new StringEnum<WorkflowRunConclusion>(conclusion.Value) : null,
        HeadBranch = branch,
        Event = "push",
        RunNumber = 1,
        Status = new StringEnum<WorkflowRunStatus>(status),
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = updatedAt ?? DateTimeOffset.UtcNow,
        HtmlUrl = "https://github.com",
    };

    private static WorkflowModel CreateWorkflow(params WorkflowRunModel[] runs) => new()
    {
        NodeId = "wf1",
        Name = "CI",
        HtmlUrl = "https://github.com",
        Runs = [.. runs],
    };

    [Fact]
    public void NoRuns_ReturnsNone()
    {
        var workflow = CreateWorkflow();
        Assert.Equal(WorkflowStatus.None, workflow.OverallStatus);
    }

    [Fact]
    public void AllSuccess_ReturnsGreen()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Success, "main"),
            CreateRun(WorkflowRunConclusion.Success, "develop"));

        Assert.Equal(WorkflowStatus.Green, workflow.OverallStatus);
    }

    [Fact]
    public void AnyFailure_ReturnsRed()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Success, "main"),
            CreateRun(WorkflowRunConclusion.Failure, "develop"));

        Assert.Equal(WorkflowStatus.Red, workflow.OverallStatus);
    }

    [Fact]
    public void AnyAmber_NoFailure_ReturnsAmber()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Success, "main"),
            CreateRun(WorkflowRunConclusion.Cancelled, "develop"));

        Assert.Equal(WorkflowStatus.Amber, workflow.OverallStatus);
    }

    [Fact]
    public void RedTakesPrecedenceOverAmber()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Cancelled, "main"),
            CreateRun(WorkflowRunConclusion.Failure, "develop"));

        Assert.Equal(WorkflowStatus.Red, workflow.OverallStatus);
    }

    [Fact]
    public void UsesLatestRunPerBranch()
    {
        // Older run failed, but latest run on same branch succeeded
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Failure, "main", DateTimeOffset.UtcNow.AddHours(-1)),
            CreateRun(WorkflowRunConclusion.Success, "main", DateTimeOffset.UtcNow));

        Assert.Equal(WorkflowStatus.Green, workflow.OverallStatus);
    }

    [Fact]
    public void UsesLatestRunPerBranch_OlderSuccessNewerFailure()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Success, "main", DateTimeOffset.UtcNow.AddHours(-1)),
            CreateRun(WorkflowRunConclusion.Failure, "main", DateTimeOffset.UtcNow));

        Assert.Equal(WorkflowStatus.Red, workflow.OverallStatus);
    }

    [Fact]
    public void RunningOnOneBranch_ReturnsRunning()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Success, "main"),
            CreateRun(null, "develop", status: WorkflowRunStatus.InProgress));

        Assert.Equal(WorkflowStatus.Running, workflow.OverallStatus);
    }

    [Fact]
    public void WaitingOnOneBranch_ReturnsWaiting()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Success, "main"),
            CreateRun(null, "develop", status: WorkflowRunStatus.Waiting));

        Assert.Equal(WorkflowStatus.Waiting, workflow.OverallStatus);
    }

    [Fact]
    public void RedTakesPrecedenceOverRunning()
    {
        var workflow = CreateWorkflow(
            CreateRun(WorkflowRunConclusion.Failure, "main"),
            CreateRun(null, "develop", status: WorkflowRunStatus.InProgress));

        Assert.Equal(WorkflowStatus.Red, workflow.OverallStatus);
    }

    [Fact]
    public void WaitingTakesPrecedenceOverRunning()
    {
        var workflow = CreateWorkflow(
            CreateRun(null, "main", status: WorkflowRunStatus.Waiting),
            CreateRun(null, "develop", status: WorkflowRunStatus.InProgress));

        Assert.Equal(WorkflowStatus.Waiting, workflow.OverallStatus);
    }
}
