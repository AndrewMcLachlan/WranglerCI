using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Models.Dashboard;
using Octokit;

namespace Asm.Wrangler.Tests;

public class RepositoryOverallStatusTests
{
    private static WorkflowRunModel CreateRun(
        WorkflowRunConclusion? conclusion,
        string branch = "main",
        DateTimeOffset? updatedAt = null) => new()
    {
        Id = Random.Shared.Next(),
        WorkflowId = 1,
        NodeId = "node1",
        Conclusion = conclusion.HasValue ? new StringEnum<WorkflowRunConclusion>(conclusion.Value) : null,
        HeadBranch = branch,
        Event = "push",
        RunNumber = 1,
        Status = new StringEnum<WorkflowRunStatus>(WorkflowRunStatus.Completed),
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

    private static RepositoryModel CreateRepo(params WorkflowModel[] workflows) => new()
    {
        Name = "test-repo",
        Owner = "owner",
        NodeId = "repo1",
        HtmlUrl = "https://github.com",
        Workflows = workflows,
    };

    [Fact]
    public void NoWorkflows_ReturnsNone()
    {
        var repo = CreateRepo();
        Assert.Equal(RagStatus.None, repo.OverallStatus);
    }

    [Fact]
    public void AllGreen_AcrossWorkflows()
    {
        var repo = CreateRepo(
            CreateWorkflow(CreateRun(WorkflowRunConclusion.Success, "main")),
            CreateWorkflow(CreateRun(WorkflowRunConclusion.Success, "main")));

        Assert.Equal(RagStatus.Green, repo.OverallStatus);
    }

    [Fact]
    public void FailureInOneWorkflow_ReturnsRed()
    {
        var repo = CreateRepo(
            CreateWorkflow(CreateRun(WorkflowRunConclusion.Success, "main")),
            CreateWorkflow(CreateRun(WorkflowRunConclusion.Failure, "main")));

        Assert.Equal(RagStatus.Red, repo.OverallStatus);
    }

    [Fact]
    public void AggregatesAcrossWorkflowsAndBranches()
    {
        // Workflow 1: main=success, develop=cancelled (amber)
        // Workflow 2: main=success
        // Overall should be amber (worst across all)
        var repo = CreateRepo(
            CreateWorkflow(
                CreateRun(WorkflowRunConclusion.Success, "main"),
                CreateRun(WorkflowRunConclusion.Cancelled, "develop")),
            CreateWorkflow(
                CreateRun(WorkflowRunConclusion.Success, "main")));

        Assert.Equal(RagStatus.Amber, repo.OverallStatus);
    }

    [Fact]
    public void UsesLatestRunPerBranchPerWorkflow()
    {
        var repo = CreateRepo(
            CreateWorkflow(
                CreateRun(WorkflowRunConclusion.Failure, "main", DateTimeOffset.UtcNow.AddHours(-1)),
                CreateRun(WorkflowRunConclusion.Success, "main", DateTimeOffset.UtcNow)));

        Assert.Equal(RagStatus.Green, repo.OverallStatus);
    }
}
