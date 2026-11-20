using Asm.Wrangler.Api.Authentication;
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
    /// Merges the specified pull requests, approving each first where the current user's approval is needed and allowed.
    /// </summary>
    /// <param name="request">The pull requests to approve and merge.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The result of each approve-and-merge operation.</returns>
    Task<IEnumerable<ApprovalResult>> ApprovePullRequestsAsync(ApprovePullRequests request, CancellationToken cancellationToken);

    /// <summary>
    /// Enables auto-merge on the specified pull requests, approving each first where the current user's approval is needed and allowed.
    /// A pull request that can merge already is merged now, as GitHub refuses auto-merge for it.
    /// </summary>
    /// <param name="request">The pull requests to enable auto-merge on.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The result for each pull request.</returns>
    Task<IEnumerable<ApprovalResult>> EnableAutoMergeAsync(EnableAutoMerge request, CancellationToken cancellationToken);
}

internal class PullRequestService(IGitHubClient gitHubClient, IDistributedCache cache, ICacheKeyService cacheKeyService, IRepoVersionService versions, IHttpContextAccessor httpContextAccessor, ILogger<PullRequestService> logger) : GitHubService(cache, logger), IPullRequestService
{
    /// <summary>
    /// How long a repo's pull requests are trusted without a webhook saying otherwise. Bounds how stale
    /// a repo gets when its deliveries never arrive, and how late a base-branch push shows in MergeState.
    /// </summary>
    internal static readonly TimeSpan PullRequestCacheLifetime = TimeSpan.FromMinutes(2);

    private static readonly Uri GraphQLUri = new("graphql", UriKind.Relative);

    private readonly SemaphoreSlim _gate = new(8);

    public async Task<IEnumerable<PullRequestModel>> GetPullRequestsAsync(PullRequests request, CancellationToken cancellationToken)
    {
        var viewer = httpContextAccessor.HttpContext?.Session.GetString(SessionKeys.User);
        if (request.Mine && !request.Bots && viewer is null) return [];

        var filter = request.Bots ? PullRequestFilter.Bots : request.Mine ? PullRequestFilter.Mine(viewer!) : PullRequestFilter.ByAuthors(request.Authors);
        var tasks = request.Repositories.Select(repo => GetRepoPullRequestsAsync(repo.Owner, repo.Name, filter, cancellationToken));

        var results = await Task.WhenAll(tasks);

        return results.SelectMany(r => r);
    }

    public Task<IEnumerable<ApprovalResult>> ApprovePullRequestsAsync(ApprovePullRequests request, CancellationToken cancellationToken) =>
        ForEachByRepoAsync(request.PullRequests, ApproveAndMergeAsync, cancellationToken);

    public Task<IEnumerable<ApprovalResult>> EnableAutoMergeAsync(EnableAutoMerge request, CancellationToken cancellationToken) =>
        ForEachByRepoAsync(request.PullRequests, ApproveAndEnableAutoMergeAsync, cancellationToken);

    private async Task<IEnumerable<ApprovalResult>> ForEachByRepoAsync(IEnumerable<ApprovePullRequests.PullRequestReference> pullRequests, Func<string, string, int, PullRequestMergeMethod, CancellationToken, Task<ApprovalResult>> action, CancellationToken cancellationToken)
    {
        // Group by repo so that PRs targeting the same base branch are merged
        // sequentially, avoiding "Base branch was modified" race conditions.
        // Different repos are still processed in parallel.
        var repoGroups = pullRequests.GroupBy(pr => (pr.Owner, pr.Repo));

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
                        Error = $"Could not determine allowed merge methods: {GitHubErrors.Describe(ex)}",
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
                results.Add(await action(pr.Owner, pr.Repo, pr.Number, mergeMethod.Value, cancellationToken));
            }

            // The refetch that follows must not be served the cached list, which still shows these as unmerged and not auto-merging.
            if (results.Any(r => r.Merged || r.AutoMergeEnabled))
            {
                await versions.BumpAsync(group.Key.Owner, group.Key.Repo, RepoDataKind.Pulls, cancellationToken);
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

    private async Task<IEnumerable<PullRequestModel>> GetRepoPullRequestsAsync(string owner, string repo, PullRequestFilter filter, CancellationToken cancellationToken)
    {
        var pullsVersion = await versions.GetVersionAsync(owner, repo, RepoDataKind.Pulls, cancellationToken);
        var checksVersion = await versions.GetVersionAsync(owner, repo, RepoDataKind.Checks, cancellationToken);
        var cacheKey = cacheKeyService.GetCacheKey($"gh:pulls:{owner}/{repo}:p{pullsVersion}:c{checksVersion}:{filter.CacheKey}");

        var cached = await TryGetFromCache<PullRequestModel>(cacheKey, cancellationToken);
        if (cached is not null) return cached;

        var pullRequests = (await FetchRepoPullRequestsAsync(owner, repo, filter, cancellationToken)).ToList();
        await TryCache(cacheKey, pullRequests, cancellationToken, PullRequestCacheLifetime);
        return pullRequests;
    }

    private async Task<IEnumerable<PullRequestModel>> FetchRepoPullRequestsAsync(string owner, string repo, PullRequestFilter filter, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);
            var prs = await OctoCall(() => gitHubClient.PullRequest.GetAllForRepository(owner, repo, new PullRequestRequest { State = ItemStateFilter.Open }), cancellationToken);

            var filtered = prs.Where(pr => filter.Matches(pr.User.Login, pr.User.Type == AccountType.Bot, [.. (pr.Assignees ?? []).Select(a => a.Login)])).ToList();
            if (filtered.Count == 0) return [];

            var statuses = await GetPullRequestStatusesAsync(owner, repo, cancellationToken);
            var viewer = httpContextAccessor.HttpContext?.Session.GetString(SessionKeys.User);

            return filtered.Select(pr =>
            {
                var status = statuses.GetValueOrDefault(pr.Number);
                var isOwn = String.Equals(pr.User.Login, viewer, StringComparison.OrdinalIgnoreCase);

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
                    CheckStatus = status?.CheckStatus ?? CheckStatus.Unknown,
                    UnresolvedThreads = status?.UnresolvedThreads,
                    ReviewDecision = status?.ReviewDecision,
                    MergeState = status?.MergeState,
                    Blockers = MergeBlockers.For(status?.MergeState, status?.ReviewDecision, status?.UnresolvedThreads ?? 0, isOwn, pr.Draft),
                    AutoMerge = status?.AutoMerge ?? false,
                    Labels = [.. pr.Labels.Select(l => new PullRequestLabel { Name = l.Name, Color = l.Color })],
                };
            }).ToList();
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<IReadOnlyDictionary<int, PullRequestStatus>> GetPullRequestStatusesAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        try
        {
            Dictionary<int, PullRequestStatus> statuses = [];
            string? cursor = null;
            do
            {
                var body = new { query = PullRequestStatusResponse.Query, variables = new Dictionary<string, object?> { ["owner"] = owner, ["name"] = repo, ["cursor"] = cursor } };
                var response = await OctoCall(() => gitHubClient.Connection.Post<PullRequestStatusResponse>(GraphQLUri, body, "application/json", "application/json"), cancellationToken);
                foreach (var (number, status) in response.Body?.ByNumber() ?? new Dictionary<int, PullRequestStatus>()) statuses[number] = status;
                cursor = response.Body?.NextCursor;
            }
            while (cursor is not null);

            return statuses;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not read pull request statuses for {Owner}/{Repo}", owner, repo);
            return new Dictionary<int, PullRequestStatus>();
        }
    }

    private async Task<PullRequestStatusNode?> GetMergeContextAsync(string owner, string repo, int number, CancellationToken cancellationToken)
    {
        var body = new { query = MergeContextResponse.Query, variables = new Dictionary<string, object> { ["owner"] = owner, ["name"] = repo, ["number"] = number } };
        var response = await OctoCall(() => gitHubClient.Connection.Post<MergeContextResponse>(GraphQLUri, body, "application/json", "application/json"), cancellationToken);
        return response.Body?.Data?.Repository?.PullRequest;
    }

    private bool NeedsApproval(PullRequestStatusNode? pullRequest)
    {
        var viewer = httpContextAccessor.HttpContext?.Session.GetString(SessionKeys.User);
        var isOwn = String.Equals(pullRequest?.Author?.Login, viewer, StringComparison.OrdinalIgnoreCase);

        return MergeBlockers.NeedsApproval(pullRequest?.ToStatus().ReviewDecision, isOwn);
    }

    private Task ApproveAsync(string owner, string repo, int number, CancellationToken cancellationToken) =>
        OctoCall(() => gitHubClient.PullRequest.Review.Create(owner, repo, number, new PullRequestReviewCreate
        {
            Event = PullRequestReviewEvent.Approve,
        }), cancellationToken);

    private async Task<ApprovalResult> ApproveAndMergeAsync(string owner, string repo, int number, PullRequestMergeMethod mergeMethod, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            try
            {
                if (NeedsApproval(await GetMergeContextAsync(owner, repo, number, cancellationToken)))
                {
                    await ApproveAsync(owner, repo, number, cancellationToken);
                }
            }
            catch (Exception ex)
            {
                return Result(owner, repo, number, approved: false, error: GitHubErrors.Describe(ex));
            }

            return await MergeNowAsync(owner, repo, number, mergeMethod, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<ApprovalResult> ApproveAndEnableAutoMergeAsync(string owner, string repo, int number, PullRequestMergeMethod mergeMethod, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await Jitter(cancellationToken);

            PullRequestStatusNode? pullRequest;
            try
            {
                pullRequest = await GetMergeContextAsync(owner, repo, number, cancellationToken);
                if (NeedsApproval(pullRequest))
                {
                    await ApproveAsync(owner, repo, number, cancellationToken);
                    pullRequest = await GetMergeContextAsync(owner, repo, number, cancellationToken);
                }
            }
            catch (Exception ex)
            {
                return Result(owner, repo, number, approved: false, error: GitHubErrors.Describe(ex));
            }

            if (pullRequest?.AutoMergeRequest is not null) return Result(owner, repo, number, approved: true, autoMergeEnabled: true);
            if (CanMergeNow(pullRequest)) return await MergeNowAsync(owner, repo, number, mergeMethod, cancellationToken);

            try
            {
                var body = new { query = EnableAutoMergeResponse.Mutation, variables = new Dictionary<string, object?> { ["id"] = pullRequest?.Id, ["method"] = mergeMethod.ToString().ToUpperInvariant() } };
                var response = await OctoCall(() => gitHubClient.Connection.Post<EnableAutoMergeResponse>(GraphQLUri, body, "application/json", "application/json"), cancellationToken);
                if (response.Body?.Errors is { Count: > 0 } errors) throw new InvalidOperationException(String.Join(" ", errors.Select(e => e.Message)));
            }
            catch (Exception ex)
            {
                if (await IsMergedAsync(owner, repo, number, cancellationToken)) return Result(owner, repo, number, approved: true, merged: true);

                // GitHub refuses auto-merge on a pull request that became mergeable after the context was read.
                if (CanMergeNow(await TryGetMergeContextAsync(owner, repo, number, cancellationToken))) return await MergeNowAsync(owner, repo, number, mergeMethod, cancellationToken);

                return Result(owner, repo, number, approved: true, error: GitHubErrors.Describe(ex));
            }

            return Result(owner, repo, number, approved: true, autoMergeEnabled: true);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<ApprovalResult> MergeNowAsync(string owner, string repo, int number, PullRequestMergeMethod mergeMethod, CancellationToken cancellationToken)
    {
        try
        {
            await OctoCall(() => gitHubClient.PullRequest.Merge(owner, repo, number, new MergePullRequest { MergeMethod = mergeMethod }), cancellationToken);
        }
        catch (Exception ex)
        {
            // Approving can trigger the PR's auto-merge, which beats this call to it and fails it with "Base branch was modified".
            if (!await IsMergedAsync(owner, repo, number, cancellationToken))
            {
                return Result(owner, repo, number, approved: true, error: GitHubErrors.Describe(ex));
            }
        }

        return Result(owner, repo, number, approved: true, merged: true);
    }

    private async Task<PullRequestStatusNode?> TryGetMergeContextAsync(string owner, string repo, int number, CancellationToken cancellationToken)
    {
        try
        {
            return await GetMergeContextAsync(owner, repo, number, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not read the merge state of {Owner}/{Repo}#{Number}", owner, repo, number);
            return null;
        }
    }

    private async Task<bool> IsMergedAsync(string owner, string repo, int number, CancellationToken cancellationToken)
    {
        try
        {
            var pullRequest = await OctoCall(() => gitHubClient.PullRequest.Get(owner, repo, number), cancellationToken);
            return pullRequest.Merged;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Could not check whether {Owner}/{Repo}#{Number} merged", owner, repo, number);
            return false;
        }
    }

    private static bool CanMergeNow(PullRequestStatusNode? pullRequest) =>
        pullRequest?.ToStatus().MergeState is MergeState.Clean or MergeState.HasHooks or MergeState.Unstable;

    private static ApprovalResult Result(string owner, string repo, int number, bool approved, bool merged = false, bool autoMergeEnabled = false, string? error = null) => new()
    {
        RepositoryOwner = owner,
        RepositoryName = repo,
        PullRequestNumber = number,
        Approved = approved,
        Merged = merged,
        AutoMergeEnabled = autoMergeEnabled,
        Error = error,
    };
}
