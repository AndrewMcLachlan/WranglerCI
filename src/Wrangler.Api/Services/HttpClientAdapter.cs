using Octokit;
using Octokit.Internal;

namespace Asm.Wrangler.Api.Services;

/// <summary>
/// An HTTP client adapter that automatically adds ETag-based conditional request headers.
/// </summary>
public class ETagHttpClientAdapter(IETagCacheService eTagCacheService, ILogger<ETagHttpClientAdapter> logger) : HttpClientAdapter(new(HttpMessageHandlerFactory.CreateDefault))
{
    /// <inheritdoc />
    protected override HttpRequestMessage BuildRequestMessage(IRequest request)
    {
        var message = base.BuildRequestMessage(request);

        try
        {
            // Get the ETag for this URL if available
            var etag = eTagCacheService.GetETagAsync(request.Endpoint).Result;

            // Clone the request to add ETag header if we have one
            if (!String.IsNullOrEmpty(etag))
            {
                message.Headers.Add("If-None-Match", etag);
            }
        }
        catch (AggregateException ex) when (ex.InnerException is InvalidOperationException iex)
        {
            logger.LogWarning(iex, "Unable to access cache");
        }
        catch (AggregateException ex) when (ex.InnerException is TimeoutException tex)
        {
            logger.LogWarning(tex, "Timeout accessing the cache");
        }

        return message;
    }

    /// <inheritdoc />
    protected override Task<IResponse> BuildResponse(HttpResponseMessage responseMessage, Func<object, object> preprocessResponseBody)
    {
        if (responseMessage.Headers.ETag is not null && responseMessage.RequestMessage?.RequestUri is not null)
        {
            try
            {
                eTagCacheService.SetETagAsync(responseMessage.RequestMessage?.RequestUri!, responseMessage.Headers.ETag.Tag).ConfigureAwait(false);
            }
            catch (InvalidOperationException iex)
            {
                logger.LogWarning(iex, "Unable to access cache");
            }
            catch (TimeoutException tex)
            {
                logger.LogWarning(tex, "Timeout accessing the cache");
            }
        }

        return base.BuildResponse(responseMessage, preprocessResponseBody);
    }
}
