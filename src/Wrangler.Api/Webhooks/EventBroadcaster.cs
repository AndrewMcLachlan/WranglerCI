using System.Collections.Concurrent;
using System.Threading.Channels;
using Asm.Wrangler.Api.Models;

namespace Asm.Wrangler.Api.Webhooks;

internal class EventBroadcaster : IEventBroadcaster
{
    private const int SubscriberQueueCapacity = 64;

    private readonly ConcurrentDictionary<Guid, Channel<GitHubEvent>> _subscribers = new();

    public EventSubscription Subscribe()
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<GitHubEvent>(new BoundedChannelOptions(SubscriberQueueCapacity)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
        _subscribers[id] = channel;
        return new EventSubscription(id, channel.Reader, Unsubscribe);
    }

    public void Publish(GitHubEvent evt)
    {
        foreach (var subscriber in _subscribers.Values)
        {
            subscriber.Writer.TryWrite(evt);
        }
    }

    private void Unsubscribe(Guid id)
    {
        if (_subscribers.TryRemove(id, out var channel))
        {
            channel.Writer.TryComplete();
        }
    }
}
