namespace Asm.Wrangler.Api.Models.Gates;

/// <summary>
/// Subset of GitHub's <c>pending_deployments</c> REST payload. Octokit 14
/// exposes the review (write) but no typed read, so we deserialise this via
/// <c>IConnection.Get</c>. Octokit's serializer maps PascalCase property
/// names to the snake_case JSON keys (e.g. <c>current_user_can_approve</c>).
/// </summary>
public class PendingDeploymentResponse
{
    public PendingDeploymentEnvironment Environment { get; set; } = new();
    public bool CurrentUserCanApprove { get; set; }
}

public class PendingDeploymentEnvironment
{
    public long Id { get; set; }
    public string Name { get; set; } = String.Empty;
}
