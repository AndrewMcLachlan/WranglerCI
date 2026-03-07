namespace Asm.Wrangler.Api.Exceptions;

/// <summary>
/// Thrown when a request requires authentication but no valid credentials are available.
/// </summary>
public class UnauthorizedException : Exception
{
    /// <summary>
    /// Initialises a new instance of the <see cref="UnauthorizedException"/> class.
    /// </summary>
    public UnauthorizedException() : base("Unauthorized access")
    {
    }
}
