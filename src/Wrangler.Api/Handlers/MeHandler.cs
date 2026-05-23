using Microsoft.AspNetCore.Http.HttpResults;

namespace Asm.Wrangler.Api.Handlers;

/// <summary>
/// Identity of the currently authenticated GitHub user.
/// </summary>
public record CurrentUserModel
{
    /// <summary>The user's GitHub login (username).</summary>
    public required string Login { get; init; }

    /// <summary>The URL of the user's GitHub avatar image.</summary>
    public string? AvatarUrl { get; init; }
}

/// <summary>
/// Returns the current authenticated user, if any.
/// </summary>
public static class MeHandler
{
    public static Results<Ok<CurrentUserModel>, UnauthorizedHttpResult> Handle(HttpContext http)
    {
        var login = http.Session.GetString("github_user");
        if (String.IsNullOrEmpty(login)) return TypedResults.Unauthorized();
        return TypedResults.Ok(new CurrentUserModel
        {
            Login = login,
            AvatarUrl = http.Session.GetString("github_avatar_url"),
        });
    }
}
