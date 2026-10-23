using Asm.Wrangler.Api.Models.PullRequests;
using Asm.Wrangler.Api.Commands;
using Asm.Wrangler.Api.GraphQL;
using Asm.Wrangler.Api.Queries;
using Asm.Wrangler.Api.Webhooks;
using Microsoft.Extensions.Caching.Distributed;
using Octokit;

using CheckStatus = Asm.Wrangler.Api.Models.PullRequests.CheckStatus;

namespace Asm.Wrangler.Api.Services;

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
    Task<IEnumerable<PullRequestModel>> GetPullRequestsAsync(PullRequests request, CancellationToken cancellationToken);

    /// <summary>
    /// Approves and merges the specified pull requests.
    /// </summary>
    /// <param name="request">The pull requests to approve and merge.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The result of each approve-and-merge operation.</returns>
    Task<IEnumerable<ApprovalResult>> ApprovePullRequestsAsync(ApprovePullRequests request, CancellationToken cancellationToken);
}

internal class PullRequestService(IGitHubClient gitHubClient, IDistributedCache cache, ICacheKeyService cacheKeyService, IRepoVersionService versions, ILogger<PullRequestService> logger) : GitHubService(cache, logger), IPullRequestService
{
    /// <summary>
    /// How long a repo's pull requests are trusted without a webhook saying otherwise. Bounds how stale
    /// a repo gets when its deliveries never arrive, and how late a base-branch push shows in Mergeable.
    /// </summary>
    internal static readonly TimeSpan PullRequestCacheLifetime = TimeSpan.FromMinutes(2);

    private static readonly Uri GraphQLUri = new("graphql", UriKind.Relative);

    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<PullRequestModel>> GetPullRequestsAsync(PullRequests request, CancellationToken cancellationToken)
    {
        var tasks = request.Repositories.Select(repo => GetRepoPullRequestsAsync(repo.Owner, repo.Name, request.Authors, cancellationToken));

        var results = await Task.WhenAll(tasks);

        return results.SelectMany(r => r);
    }

    public async Task<IEnumerable<ApprovalResult>> ApprovePullRequestsAsync(ApprovePullRequests request, CancellationToken cancellationToken)
    {
        // Group by repo so that PRs targeting the same base branch are merged
        // sequentially, avoiding "Base branch was modified" race conditions.
        // Different repos are still processed in parallel.
        var repoGroups = request.PullRequests.GroupBy(pr => (pr.Owner, pr.Repo));

        var repoTasks = repoGroups.Select(async group =>
        {
            var results = new List<ApprovalResult>();

            PullRequestMergeMethod? mergeMethod;
            try
            {
                mergeMethod = await GetPreferredMergeMethodAsync(group.Key.Owner, group.Key.Repo, cancellationToken);
            }
            catch (Exception ex)
            {
                foreach (var pr in group)
                {
                    results.Add(new ApprovalResult
                    {
                        RepositoryOwner = pr.Owner,
                        RepositoryName = pr.Repo,
                        PullRequestNumber = pr.Number,
                        Approved = false,
                        Merged = false,
                        Error = $"Could not determine allowed merge methods: {ex.Message}",
                    });
                }
                return results;
            }

            if (mergeMethod is null)
            {
                foreach (var pr in group)
                {
                    results.Add(new ApprovalResult
                    {
                        RepositoryOwner = pr.Owner,
                        RepositoryName = pr.Repo,
                        PullRequestNumber = pr.Number,
                        Approved = false,
                        Merged = false,
                        Error = "Repository does not allow any merge method.",
                    });
                }
                return results;
            }

            foreach (var pr in group)
            {
                results.Add(await ApproveAndMergeAsync(pr.Owner, pr.Repo, pr.Number, mergeMethod.Value, cancellationToken));
            }
            return results;
        });

        var allResults = await Task.WhenAll(repoTasks);
        return allResults.SelectMany(r => r);
    }

    private async Task<PullRequestMergeMethod?> GetPreferredMergeMethodAsync(string owner, string repo, CancellationToken cancellationToken)
    {
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

        // Preference order per issue #130: Merge → Squash → Rebase.
        // Octokit returns null when the field is not present; treat that as allowed
        // so we still attempt a sensible default rather than failing outright.
        if (repository.AllowMergeCommit ?? true) return PullRequestMergeMethod.Merge;
        if (repository.AllowSquashMerge ?? false) return PullRequestMergeMethod.Squash;
        if (repository.AllowRebaseMerge ?? false) return PullRequestMergeMethod.Rebase;

        return null;
    }

    private async Task<IEnumerable<PullRequestModel>> GetRepoPullRequestsAsync(string owner, string repo, IReadOnlyList<string> authors, CancellationToken cancellationToken)
    {
        var pullsVersion = await versions.GetVersionAsync(owner, repo, RepoDataKind.Pulls, cancellationToken);
        var checksVersion = await versions.GetVersionAsync(owner, repo, RepoDataKind.Checks, cancellationToken);
        var authorKey = String.Join(',', authors.Select(a => a.ToLowerInvariant()).Order());
        var cacheKey = cacheKeyService.GetCacheKey($"gh:pulls:{owner}/{repo}:p{pullsVersion}:c{checksVersion}:{authorKey}");

        var cached = await TryGetFromCache<PullRequestModel>(cacheKey, cancellationToken);
        if (cached is not null) return cached;

        var pullRequests = (await FetchRepoPullRequestsAsync(owner, repo, authors, cancellationToken)).ToList();
        await TryCache(cacheKey, pullRequests, cancellationToken, PullRequestCacheLifetime);
        return pullRequests;
    }

    private async Task<IEnumerable<PullRequestModel>> FetchRepoPullRequestsAsync(string owner, string repo, IReadOnlyList<string> authors, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var prs = await OctoCall(() => gitHubClient.PullRequest.GetAllForRepository(owner, repo, new PullRequestRequest { State = ItemStateFilter.Open }), cancellationToken);

            var filtered = prs.Where(pr => authors.Any(a => String.Equals(a, pr.User.Login, StringComparison.OrdinalIgnoreCase))).ToList();
            if (filtered.Count == 0) return [];

            var unresolvedTask = GetUnresolvedThreadsAsync(owner, repo, cancellationToken);

            // Fan out the per-PR API calls. Each task makes up to three calls
            // (combined commit status, check runs, PR detail) in parallel. The
            // previous loop awaited each PR before starting the next, so wall
            // clock was O(N * round-trip); now it's bounded by the slowest
            // single PR. OctoCall already retries on abuse / secondary rate
            // limits, so we don't add a second throttle here.
            var modelTasks = filtered.Select(async pr =>
            {
                await Jitter(cancellationToken);

                var checkStatusTask = GetCheckStatusAsync(owner, repo, pr.Head.Sha, cancellationToken);
                var detailTask = OctoCall(() => gitHubClient.PullRequest.Get(owner, repo, pr.Number), cancellationToken);

                await Task.WhenAll(checkStatusTask, detailTask, unresolvedTask);

                return new PullRequestModel
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
                    UnresolvedThreads = unresolvedTask.Result.TryGetValue(pr.Number, out var unresolved) ? unresolved : null,
                    Labels = [.. pr.Labels.Select(l => new PullRequestLabel { Name = l.Name, Color = l.Color })],
                };
            });

            return await Task.WhenAll(modelTasks);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<IReadOnlyDictionary<int, int>> GetUnresolvedThreadsAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        try
        {
            var body = new { query = ReviewThreadsResponse.Query, variables = new Dictionary<string, string> { ["owner"] = owner, ["name"] = repo } };
            var response = await OctoCall(() => gitHubClient.Connection.Post<ReviewThreadsResponse>(GraphQLUri, body, "application/json", "application/json"), cancellationToken);
            return response.Body?.UnresolvedByNumber() ?? new Dictionary<int, int>();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not read review threads for {Owner}/{Repo}", owner, repo);
            return new Dictionary<int, int>();
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

    private async Task<ApprovalResult> ApproveAndMergeAsync(string owner, string repo, int number, PullRequestMergeMethod mergeMethod, CancellationToken cancellationToken)
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
                await OctoCall(() => gitHubClient.PullRequest.Merge(owner, repo, number, new MergePullRequest { MergeMethod = mergeMethod }), cancellationToken);
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
