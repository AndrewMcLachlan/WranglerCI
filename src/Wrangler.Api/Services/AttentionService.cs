using Asm.Wrangler.Api.Models.Attention;
using Asm.Wrangler.Api.Requests;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Aggregates "needs my attention" items across multiple repositories.
/// </summary>
public interface IAttentionService
{
    Task<IEnumerable<AttentionItem>> GetAttentionItemsAsync(AttentionRequest request, CancellationToken cancellationToken);
}

internal class AttentionService(
    IGitHubClient gitHubClient,
    ISecurityAlertsService securityAlertsService,
    IHttpContextAccessor httpContextAccessor,
    IDistributedCache cache,
    ILogger<AttentionService> logger) : GitHubService(cache, logger), IAttentionService
{
    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<AttentionItem>> GetAttentionItemsAsync(AttentionRequest request, CancellationToken cancellationToken)
    {
        var currentUser = httpContextAccessor.HttpContext?.Session.GetString("github_user");

        var repoTasks = request.Repositories.Select(repo => GetRepoAttentionItemsAsync(repo.Owner, repo.Name, currentUser, cancellationToken));
        var perRepo = await Task.WhenAll(repoTasks);

        return perRepo
            .SelectMany(items => items)
            .OrderByDescending(item => item.OccurredAt);
    }

    private async Task<IEnumerable<AttentionItem>> GetRepoAttentionItemsAsync(string owner, string repo, string? currentUser, CancellationToken cancellationToken)
    {
        // Repo metadata gives us the default branch so we can match workflow
        // failures to runs on the branch the user actually cares about.
        await _gate.WaitAsync(cancellationToken);
        Repository repository;
        try
        {
            await Jitter(cancellationToken);
            repository = await OctoCall(() => gitHubClient.Repository.Get(owner, repo), cancellationToken);
        }
        finally
        {
            _gate.Release();
        }

        var workflowTask = GetWorkflowFailuresAsync(owner, repo, repository.DefaultBranch, cancellationToken);
        var reviewTask = GetPullRequestReviewsAsync(owner, repo, currentUser, cancellationToken);
        var securityTask = GetSecurityAlertsAsync(owner, repo, cancellationToken);

        await Task.WhenAll(workflowTask, reviewTask, securityTask);

        return workflowTask.Result.Concat(reviewTask.Result).Concat(securityTask.Result);
    }

    private async Task<IEnumerable<AttentionItem>> GetSecurityAlertsAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var summaries = await securityAlertsService.GetOpenAlertSummariesAsync(owner, repo, cancellationToken);

        return summaries.Select(summary => new AttentionItem
        {
            Type = AttentionItemType.SecurityAlert,
            RepositoryOwner = owner,
            RepositoryName = repo,
            Title = $"{summary.Count} open {summary.Category} alert{(summary.Count == 1 ? "" : "s")}",
            HtmlUrl = summary.HtmlUrl,
            OccurredAt = summary.NewestAt,
            AlertCount = summary.Count,
            AlertSeverity = summary.HighestSeverity,
            AlertCategory = summary.Category,
        });
    }

    private async Task<IEnumerable<AttentionItem>> GetWorkflowFailuresAsync(string owner, string repo, string defaultBranch, CancellationToken cancellationToken)
    {
        WorkflowsResponse workflows;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            workflows = await OctoCall(() => gitHubClient.Actions.Workflows.List(owner, repo), cancellationToken);
        }
        finally
        {
            _gate.Release();
        }

        // For each workflow grab its most recent run on the default branch.
        // We only emit an item when that latest run actually failed; passing
        // runs aren't "needs my attention" material.
        var runTasks = workflows.Workflows.Select(async workflow =>
        {
            await Jitter(cancellationToken);

            var runs = await OctoCall(() => gitHubClient.Actions.Workflows.Runs.ListByWorkflow(
                owner, repo, workflow.Id,
                new Octokit.WorkflowRunsRequest { Branch = defaultBranch },
                new ApiOptions { PageCount = 1, PageSize = 1, StartPage = 1 }), cancellationToken);

            var latest = runs.WorkflowRuns.FirstOrDefault();
            if (latest is null) return null;

            var conclusion = latest.Conclusion?.Value;
            if (conclusion != WorkflowRunConclusion.Failure &&
                conclusion != WorkflowRunConclusion.TimedOut &&
                conclusion != WorkflowRunConclusion.StartupFailure)
            {
                return null;
            }

            return new AttentionItem
            {
                Type = AttentionItemType.WorkflowFailure,
                RepositoryOwner = owner,
                RepositoryName = repo,
                Title = workflow.Name,
                HtmlUrl = latest.HtmlUrl,
                OccurredAt = latest.UpdatedAt,
                WorkflowRunId = latest.Id,
                WorkflowName = workflow.Name,
                Branch = latest.HeadBranch,
            };
        });

        var results = await Task.WhenAll(runTasks);
        return results.Where(r => r is not null).Cast<AttentionItem>();
    }

    private async Task<IEnumerable<AttentionItem>> GetPullRequestReviewsAsync(string owner, string repo, string? currentUser, CancellationToken cancellationToken)
    {
        if (String.IsNullOrEmpty(currentUser)) return [];

        await _gate.WaitAsync(cancellationToken);
        IReadOnlyList<PullRequest> prs;
        try
        {
            await Jitter(cancellationToken);
            prs = await OctoCall(() => gitHubClient.PullRequest.GetAllForRepository(owner, repo, new PullRequestRequest { State = ItemStateFilter.Open }), cancellationToken);
        }
        finally
        {
            _gate.Release();
        }

        return prs
            .Where(pr => pr.RequestedReviewers.Any(r => String.Equals(r.Login, currentUser, StringComparison.OrdinalIgnoreCase)))
            .Select(pr => new AttentionItem
            {
                Type = AttentionItemType.PullRequestReview,
                RepositoryOwner = owner,
                RepositoryName = repo,
                Title = pr.Title,
                HtmlUrl = pr.HtmlUrl,
                OccurredAt = pr.UpdatedAt,
                PullRequestNumber = pr.Number,
                PullRequestAuthor = pr.User.Login,
                Branch = pr.Head.Ref,
            });
    }
}
