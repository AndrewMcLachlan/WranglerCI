namespace Asm.Wrangler.Api.Services;

/// <summary>
/// How long one GitHub call may spend waiting between attempts.
/// </summary>
/// <remarks>
/// A request fans out into GitHub calls, some of them one after another, and the whole request has
/// to answer inside the reverse proxy's origin timeout — Cloudflare's is 100 seconds, after which the
/// browser gets a 524 and the work carries on for nobody. Twenty seconds per call leaves room for two
/// sequential stages plus the calls themselves.
/// </remarks>
internal static class RetryBudget
{
    public static readonly TimeSpan MaxTotalWait = TimeSpan.FromSeconds(20);

    /// <summary>
    /// The wait before the next attempt, or <see langword="null"/> to give up and let the failure
    /// through.
    /// </summary>
    /// <param name="proposed">What the retry policy would like to wait.</param>
    /// <param name="waitedSoFar">What this call has already spent waiting.</param>
    public static TimeSpan? NextDelay(TimeSpan proposed, TimeSpan waitedSoFar)
    {
        if (proposed < TimeSpan.Zero) proposed = TimeSpan.Zero;
        return waitedSoFar + proposed <= MaxTotalWait ? proposed : null;
    }
}
