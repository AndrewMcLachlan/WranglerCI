using System.Reflection;
using Asm.Wrangler.Api.Requests;
using Postie.Cqrs.Commands;
using Postie.Cqrs.Queries;
using Xunit;

namespace Wrangler.Tests.Cqrs;

public class HandlerRegistrationTests
{
    private static readonly Assembly ApiAssembly = typeof(WorkflowsRequest).Assembly;

    // Request types that carry a CQRS marker interface (IQuery<T>, ICommand<T>, or ICommand).
    public static IEnumerable<object[]> CqrsRequestTypes() =>
        ApiAssembly.GetTypes()
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
        var handlerCount = ApiAssembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .Count(t => t.GetInterfaces().Any(i => IsHandlerFor(i, requestType)));

        Assert.Equal(1, handlerCount);
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
