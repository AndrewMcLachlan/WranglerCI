using GitHubActionsDashboard.Api.Models.PullRequests;
using GitHubActionsDashboard.Api.Requests;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

using CheckStatus = GitHubActionsDashboard.Api.Models.PullRequests.CheckStatus;

namespace GitHubActionsDashboard.Api.Services;

/// <summary>
/// Provides operations for querying and managing pull requests across repositories.
/// </summary>
public interface IPullRequestService
{
    /// <summary>
    /// Retrieves open pull requests from the specified repositories, filtered by author.
    /// </summary>
    /// <param name="request">The repositories and author filters to query.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching open pull requests with their aggregated check statuses.</returns>
    Task<IEnumerable<PullRequestModel>> GetPullRequestsAsync(PullRequestsRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Approves and merges the specified pull requests.
    /// </summary>
    /// <param name="request">The pull requests to approve and merge.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The result of each approve-and-merge operation.</returns>
    Task<IEnumerable<ApprovalResult>> ApprovePullRequestsAsync(ApprovePullRequestsRequest request, CancellationToken cancellationToken);
}

internal class PullRequestService(IGitHubClient gitHubClient, IDistributedCache cache, ILogger<PullRequestService> logger) : GitHubService(cache, logger), IPullRequestService
{
    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<PullRequestModel>> GetPullRequestsAsync(PullRequestsRequest request, CancellationToken cancellationToken)
    {
        var tasks = request.Repositories.Select(repo => GetRepoPullRequestsAsync(repo.Owner, repo.Name, request.Authors, cancellationToken));

        var results = await Task.WhenAll(tasks);

        return results.SelectMany(r => r);
    }

    public async Task<IEnumerable<ApprovalResult>> ApprovePullRequestsAsync(ApprovePullRequestsRequest request, CancellationToken cancellationToken)
    {
        // Group by repo so that PRs targeting the same base branch are merged
        // sequentially, avoiding "Base branch was modified" race conditions.
        // Different repos are still processed in parallel.
        var repoGroups = request.PullRequests.GroupBy(pr => (pr.Owner, pr.Repo));

        var repoTasks = repoGroups.Select(async group =>
        {
            var results = new List<ApprovalResult>();
            foreach (var pr in group)
            {
                results.Add(await ApproveAndMergeAsync(pr.Owner, pr.Repo, pr.Number, cancellationToken));
            }
            return results;
        });

        var allResults = await Task.WhenAll(repoTasks);
        return allResults.SelectMany(r => r);
    }

    private async Task<IEnumerable<PullRequestModel>> GetRepoPullRequestsAsync(string owner, string repo, IReadOnlyList<string> authors, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var prs = await OctoCall(() => gitHubClient.PullRequest.GetAllForRepository(owner, repo, new PullRequestRequest { State = ItemStateFilter.Open }), cancellationToken);

            var filtered = prs.Where(pr => authors.Any(a => String.Equals(a, pr.User.Login, StringComparison.OrdinalIgnoreCase)));

            var models = new List<PullRequestModel>();

            foreach (var pr in filtered)
            {
                var checkStatusTask = GetCheckStatusAsync(owner, repo, pr.Head.Sha, cancellationToken);
                var detailTask = OctoCall(() => gitHubClient.PullRequest.Get(owner, repo, pr.Number), cancellationToken);

                await Task.WhenAll(checkStatusTask, detailTask);

                models.Add(new PullRequestModel
                {
                    Id = pr.Id,
                    Number = pr.Number,
                    NodeId = pr.NodeId,
                    Title = pr.Title,
                    Author = pr.User.Login,
                    RepositoryOwner = owner,
                    RepositoryName = repo,
                    HtmlUrl = pr.HtmlUrl,
                    HeadSha = pr.Head.Sha,
                    HeadRef = pr.Head.Ref,
                    CreatedAt = pr.CreatedAt,
                    UpdatedAt = pr.UpdatedAt,
                    CheckStatus = checkStatusTask.Result,
                    Mergeable = detailTask.Result.Mergeable,
                });
            }

            return models;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<CheckStatus> GetCheckStatusAsync(string owner, string repo, string sha, CancellationToken cancellationToken)
    {
        try
        {
            var statusTask = OctoCall(() => gitHubClient.Repository.Status.GetCombined(owner, repo, sha), cancellationToken);
            var checksTask = OctoCall(() => gitHubClient.Check.Run.GetAllForReference(owner, repo, sha), cancellationToken);

            await Task.WhenAll(statusTask, checksTask);

            var combinedStatus = statusTask.Result;
            var checkRuns = checksTask.Result;

            // Check commit statuses
            bool hasFailure = combinedStatus.State.Value == CommitState.Failure || combinedStatus.State.Value == CommitState.Error;
            bool allSuccess = combinedStatus.TotalCount == 0 || combinedStatus.State.Value == CommitState.Success;

            // Check check runs
            foreach (var run in checkRuns.CheckRuns)
            {
                if (run.Conclusion.HasValue)
                {
                    if (run.Conclusion.Value == CheckConclusion.Failure ||
                        run.Conclusion.Value == CheckConclusion.TimedOut ||
                        run.Conclusion.Value == CheckConclusion.Cancelled)
                    {
                        hasFailure = true;
                    }
                    else if (run.Conclusion.Value != CheckConclusion.Success &&
                             run.Conclusion.Value != CheckConclusion.Skipped &&
                             run.Conclusion.Value != CheckConclusion.Neutral)
                    {
                        allSuccess = false;
                    }
                }
                else
                {
                    // Still running
                    allSuccess = false;
                }
            }

            if (hasFailure) return CheckStatus.Failure;
            if (allSuccess) return CheckStatus.Success;
            return CheckStatus.Pending;
        }
        catch
        {
            return CheckStatus.Unknown;
        }
    }

    private async Task<ApprovalResult> ApproveAndMergeAsync(string owner, string repo, int number, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            try
            {
                await OctoCall(() => gitHubClient.PullRequest.Review.Create(owner, repo, number, new PullRequestReviewCreate
                {
                    Event = PullRequestReviewEvent.Approve,
                }), cancellationToken);
            }
            catch (Exception ex)
            {
                return new ApprovalResult
                {
                    RepositoryOwner = owner,
                    RepositoryName = repo,
                    PullRequestNumber = number,
                    Approved = false,
                    Merged = false,
                    Error = $"Approval failed: {ex.Message}",
                };
            }

            try
            {
                await OctoCall(() => gitHubClient.PullRequest.Merge(owner, repo, number, new MergePullRequest()), cancellationToken);
            }
            catch (Exception ex)
            {
                return new ApprovalResult
                {
                    RepositoryOwner = owner,
                    RepositoryName = repo,
                    PullRequestNumber = number,
                    Approved = true,
                    Merged = false,
                    Error = $"Merge failed: {ex.Message}",
                };
            }

            return new ApprovalResult
            {
                RepositoryOwner = owner,
                RepositoryName = repo,
                PullRequestNumber = number,
                Approved = true,
                Merged = true,
            };
        }
        finally
        {
            _gate.Release();
        }
    }
}
