using System.Diagnostics.CodeAnalysis;
using Octokit;

namespace Asm.Wrangler.Api.Handlers;
internal class OwnerEqualityComparer : IEqualityComparer<User>
{
    public bool Equals(User? x, User? y)
    {
        if (x is null || y is null) return false;

        // Compare the login names of the users
        return String.Equals(x.Login, y.Login, StringComparison.OrdinalIgnoreCase);
    }

    public int GetHashCode([DisallowNull] User obj)
    {
        return obj.Login.GetHashCode();
    }
}
