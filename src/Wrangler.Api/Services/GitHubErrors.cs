using System.Text.Json;
using Octokit;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// Turns a failed GitHub call into the reason GitHub gave for it.
/// </summary>
internal static class GitHubErrors
{
    /// <summary>
    /// GitHub's own reason for the failure. A 422's message is only "Unprocessable Entity": the reason is in its
    /// <c>errors</c>, which GitHub sends as plain strings or as objects with a message.
    /// </summary>
    public static string Describe(Exception exception)
    {
        if (exception is not ApiException apiException) return exception.Message;

        var details = Details(apiException.HttpResponse?.Body as string);
        if (details.Count > 0) return String.Join("; ", details);

        return apiException.ApiError?.Message is { Length: > 0 } message ? message : apiException.Message;
    }

    private static List<string> Details(string? body)
    {
        if (String.IsNullOrWhiteSpace(body)) return [];

        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.ValueKind != JsonValueKind.Object || !document.RootElement.TryGetProperty("errors", out var errors) || errors.ValueKind != JsonValueKind.Array) return [];

            return [.. errors.EnumerateArray()
                .Select(e => e.ValueKind switch
                {
                    JsonValueKind.String => e.GetString(),
                    JsonValueKind.Object when e.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String => m.GetString(),
                    _ => null,
                })
                .OfType<string>()
                .Where(m => m.Length > 0)];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
