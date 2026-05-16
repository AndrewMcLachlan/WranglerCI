using System.Threading.Channels;
using Asm.Wrangler.Api.Models;

namespace Asm.Wrangler.Api.Webhooks;

/// <summary>
/// In-process fan-out of webhook events to active SSE subscribers.
/// </summary>
public interface IEventBroadcaster
{
    /// <summary>
    /// Registers a new subscriber. Dispose the returned subscription to
    /// stop receiving events.
    /// </summary>
    EventSubscription Subscribe();

    /// <summary>
    /// Fans out an event to every active subscriber. Slow consumers drop
    /// older queued events rather than blocking the publisher.
    /// </summary>
    void Publish(GitHubEvent evt);
}

/// <summary>
/// A live SSE subscription. Disposing it removes the subscriber from
/// the broadcaster.
/// </summary>
public sealed class EventSubscription(Guid id, ChannelReader<GitHubEvent> reader, Action<Guid> onDispose) : IDisposable
{
    public Guid Id { get; } = id;
    public ChannelReader<GitHubEvent> Reader { get; } = reader;

    public void Dispose() => onDispose(Id);
}
