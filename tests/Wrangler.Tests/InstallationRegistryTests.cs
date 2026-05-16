using Asm.Wrangler.Api.Webhooks;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Asm.Wrangler.Tests;

public class InstallationRegistryTests
{
    private static (InstallationRegistry registry, IDistributedCache cache) CreateRegistry()
    {
        var cache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        return (new InstallationRegistry(cache), cache);
    }

    private static InstallationInfo SampleInfo() => new()
    {
        Account = "octocat",
        AccountId = 1,
        Type = "User",
    };

    [Fact]
    public async Task SaveInstallation_StoresReverseLookup()
    {
        var (registry, _) = CreateRegistry();

        await registry.SaveInstallationAsync(42, SampleInfo(), ["octocat/spoon", "octocat/fork"], CancellationToken.None);

        Assert.Equal(42, await registry.GetInstallationIdForRepoAsync("octocat", "spoon", CancellationToken.None));
        Assert.Equal(42, await registry.GetInstallationIdForRepoAsync("octocat", "fork", CancellationToken.None));
    }

    [Fact]
    public async Task RemoveInstallation_ClearsReverseLookup()
    {
        var (registry, _) = CreateRegistry();

        await registry.SaveInstallationAsync(42, SampleInfo(), ["octocat/spoon"], CancellationToken.None);
        await registry.RemoveInstallationAsync(42, CancellationToken.None);

        Assert.Null(await registry.GetInstallationIdForRepoAsync("octocat", "spoon", CancellationToken.None));
    }

    [Fact]
    public async Task AddRepositories_UnionsWithExisting()
    {
        var (registry, _) = CreateRegistry();

        await registry.SaveInstallationAsync(42, SampleInfo(), ["octocat/spoon"], CancellationToken.None);
        await registry.AddRepositoriesAsync(42, ["octocat/fork", "octocat/spoon"], CancellationToken.None);

        Assert.Equal(42, await registry.GetInstallationIdForRepoAsync("octocat", "spoon", CancellationToken.None));
        Assert.Equal(42, await registry.GetInstallationIdForRepoAsync("octocat", "fork", CancellationToken.None));
    }

    [Fact]
    public async Task RemoveRepositories_DropsReverseLookupForRemovedOnly()
    {
        var (registry, _) = CreateRegistry();

        await registry.SaveInstallationAsync(42, SampleInfo(), ["octocat/spoon", "octocat/fork"], CancellationToken.None);
        await registry.RemoveRepositoriesAsync(42, ["octocat/fork"], CancellationToken.None);

        Assert.Equal(42, await registry.GetInstallationIdForRepoAsync("octocat", "spoon", CancellationToken.None));
        Assert.Null(await registry.GetInstallationIdForRepoAsync("octocat", "fork", CancellationToken.None));
    }

    [Fact]
    public async Task TryClaimDelivery_FirstCallSucceedsDuplicateFails()
    {
        var (registry, _) = CreateRegistry();

        Assert.True(await registry.TryClaimDeliveryAsync("delivery-1", CancellationToken.None));
        Assert.False(await registry.TryClaimDeliveryAsync("delivery-1", CancellationToken.None));
    }

    [Fact]
    public async Task TryClaimDelivery_DifferentIdsAreIndependent()
    {
        var (registry, _) = CreateRegistry();

        Assert.True(await registry.TryClaimDeliveryAsync("a", CancellationToken.None));
        Assert.True(await registry.TryClaimDeliveryAsync("b", CancellationToken.None));
    }

    [Fact]
    public async Task SetSuspended_MutatesStoredInfo()
    {
        var (registry, cache) = CreateRegistry();

        await registry.SaveInstallationAsync(42, SampleInfo(), [], CancellationToken.None);
        await registry.SetSuspendedAsync(42, suspended: true, CancellationToken.None);

        var json = await cache.GetStringAsync("gh:install:42", CancellationToken.None);
        Assert.NotNull(json);
        Assert.Contains("\"SuspendedAt\":", json);
    }
}
