namespace GitHubActionsDashboard.Api.Models.PullRequests;

/// <summary>
/// The aggregated status of all checks and statuses for a pull request.
/// </summary>
public enum CheckStatus
{
    /// <summary>
    /// One or more checks are still running.
    /// </summary>
    Pending,

    /// <summary>
    /// All checks have completed successfully.
    /// </summary>
    Success,

    /// <summary>
    /// One or more checks have failed.
    /// </summary>
    Failure,

    /// <summary>
    /// The status is unknown, which can occur if there was an error retrieving the check runs.
    /// </summary>
    Unknown,
}
