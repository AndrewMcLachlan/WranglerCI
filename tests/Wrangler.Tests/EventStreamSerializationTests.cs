using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Asm.Wrangler.Api.Models;
using Asm.Wrangler.Api.Models.Dashboard;
using Asm.Wrangler.Api.Serialisation;
using Asm.Wrangler.Api.Webhooks;
using Octokit;
using Xunit;
using WWorkflowRun = Octokit.Webhooks.Models.WorkflowRun;

namespace Wrangler.Tests;

/// <summary>
/// Guards the hand-written SSE contract: <see cref="Asm.Wrangler.Api.Endpoints.EventStreamHandler"/>
/// serializes each <see cref="GitHubEvent"/> using the app's configured JSON options. Those options
/// register Octokit StringEnum converters + a JsonStringEnumConverter for WorkflowStatus, so the run's
/// status/conclusion emit GitHub's raw string tokens (not objects) and workflowStatus emits its enum
/// name (not a number). A bare JsonSerializerDefaults.Web instance would corrupt all three.
/// </summary>
public class EventStreamSerializationTests
{
    // Mirrors the two Configure<JsonOptions> blocks in Program.cs — the same converters the handler
    // now serializes with.
    private static JsonSerializerOptions BuildAppOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };
        options.Converters.Add(new StringEnumJsonConverter<WorkflowRunStatus>());
        options.Converters.Add(new StringEnumJsonConverter<WorkflowRunConclusion>());
        options.Converters.Add(new JsonStringEnumConverter<WorkflowStatus>());
        return options;
    }

    [Fact]
    public void GitHubEvent_with_run_serializes_status_conclusion_and_workflowStatus_as_strings()
    {
        var run = New<WWorkflowRun>();
        Set(run, "Id", 111L);
        Set(run, "WorkflowId", 222L);
        Set(run, "NodeId", "WR_node_1");
        Set(run, "HeadBranch", "main");
        Set(run, "Event", "push");
        Set(run, "RunNumber", 42L);
        Set(run, "Status", MakeWebhooksStringEnum<Octokit.Webhooks.Models.WorkflowRunStatus>("completed"));
        Set(run, "Conclusion", MakeWebhooksStringEnum<Octokit.Webhooks.Models.WorkflowRunConclusion>("failure"));
        Set(run, "CreatedAt", DateTimeOffset.Parse("2026-07-25T10:00:00Z"));
        Set(run, "UpdatedAt", DateTimeOffset.Parse("2026-07-25T10:05:00Z"));
        Set(run, "HtmlUrl", "https://github.com/owner/repo/actions/runs/111");

        var evt = new GitHubEvent
        {
            Type = "workflow_run",
            Owner = "owner",
            Repo = "repo",
            Run = WebhookMapping.ToRunModel(run),
        };

        var json = JsonSerializer.Serialize(evt, BuildAppOptions());
        var node = JsonNode.Parse(json)!;
        var runNode = node["run"]!;

        // Status/conclusion serialize as the raw GitHub string tokens, not nested objects.
        Assert.Equal(JsonValueKind.String, runNode["status"]!.GetValue<JsonElement>().ValueKind);
        Assert.Equal("completed", runNode["status"]!.GetValue<string>());
        Assert.Equal(JsonValueKind.String, runNode["conclusion"]!.GetValue<JsonElement>().ValueKind);
        Assert.Equal("failure", runNode["conclusion"]!.GetValue<string>());

        // Derived RAG status serializes as the enum name, not a number.
        Assert.Equal(JsonValueKind.String, runNode["workflowStatus"]!.GetValue<JsonElement>().ValueKind);
        Assert.Equal("Red", runNode["workflowStatus"]!.GetValue<string>());

        // Belt-and-braces: the raw JSON carries the string tokens verbatim.
        Assert.Contains("\"status\":\"completed\"", json);
        Assert.Contains("\"conclusion\":\"failure\"", json);
        Assert.Contains("\"workflowStatus\":\"Red\"", json);
    }

    private static T New<T>() => (T)RuntimeHelpers.GetUninitializedObject(typeof(T));

    private static void Set(object target, string property, object value) =>
        target.GetType().GetProperty(property)!.SetValue(target, value);

    private static Octokit.Webhooks.Extensions.StringEnum<T> MakeWebhooksStringEnum<T>(string token)
        where T : struct, Enum =>
        new(token);
}
