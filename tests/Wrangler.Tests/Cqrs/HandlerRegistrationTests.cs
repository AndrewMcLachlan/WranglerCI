using System.Reflection;
using Asm.Wrangler.Api.Queries;
using Microsoft.Extensions.DependencyInjection;
using Postie.Cqrs.Commands;
using Postie.Cqrs.Queries;
using Xunit;

namespace Wrangler.Tests.Cqrs;

public class HandlerRegistrationTests
{
    private static readonly Assembly ApiAssembly = typeof(Workflows).Assembly;

    // Cached once so every test/theory case reuses the same reflection scan instead of re-running
    // Assembly.GetTypes() per case.
    private static readonly Type[] AllTypes = ApiAssembly.GetTypes();

    // Request types that carry a CQRS marker interface (IQuery<T>, ICommand<T>, or ICommand).
    public static IEnumerable<object[]> CqrsRequestTypes() =>
        AllTypes
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .Where(t => t.GetInterfaces().Any(IsCqrsMarker))
            .Select(t => new object[] { t });

    private static bool IsCqrsMarker(Type i) =>
        i == typeof(ICommand) ||
        (i.IsGenericType && (i.GetGenericTypeDefinition() == typeof(IQuery<>) ||
                             i.GetGenericTypeDefinition() == typeof(ICommand<>)));

    [Theory]
    [MemberData(nameof(CqrsRequestTypes))]
    public void Every_cqrs_request_has_exactly_one_handler(Type requestType)
    {
        var handlerCount = AllTypes
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .Count(t => t.GetInterfaces().Any(i => IsHandlerFor(i, requestType)));

        Assert.Equal(1, handlerCount);
    }

    // The class-existence theory above would still pass if AddPostie were deleted from Program.cs, or
    // if AddCqrs silently stopped scanning the assembly, because it never touches DI. This closes that
    // gap by inspecting the ServiceCollection AddPostie actually populates, without building a full host
    // (which would drag in Redis/session configuration unrelated to CQRS wiring).
    //
    // Postie's AddCqrs (Postie.Cqrs/PostieCqrsServiceCollectionExtensions.cs) registers each handler as a
    // closed generic ServiceDescriptor whose ServiceType is IQueryHandler<TRequest,TResponse>,
    // ICommandHandler<TRequest,TResponse>, or ICommandHandler<TRequest> - i.e. exactly the shape
    // IsHandlerFor already recognises - so the same helper can be reused against descriptor.ServiceType.
    [Fact]
    public void AddPostie_registers_a_handler_for_every_cqrs_request_type()
    {
        var services = new ServiceCollection();
        services.AddPostie(ApiAssembly);

        foreach (var requestType in CqrsRequestTypes().Select(args => (Type)args[0]))
        {
            var isRegistered = services.Any(descriptor => IsHandlerFor(descriptor.ServiceType, requestType));

            Assert.True(isRegistered, $"AddPostie did not register a handler for {requestType.Name}");
        }
    }

    // True when interface i is an IQueryHandler/ICommandHandler whose first generic argument
    // (the request type) is requestType.
    private static bool IsHandlerFor(Type i, Type requestType)
    {
        if (!i.IsGenericType) return false;
        var def = i.GetGenericTypeDefinition();
        var isHandler = def == typeof(IQueryHandler<,>) ||
                        def == typeof(ICommandHandler<,>) ||
                        def == typeof(ICommandHandler<>);
        return isHandler && i.GetGenericArguments()[0] == requestType;
    }
}
