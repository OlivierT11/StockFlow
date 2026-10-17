using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Exceptions;

/// <summary>
/// Turns the business exceptions and the concurrency conflicts into ProblemDetails responses (400, 409, 422).
/// Called by app.UseExceptionHandler before it falls back to the /error endpoint (500) for any other exception.
/// </summary>
public sealed class ApiExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ProblemDetails? problem = exception switch
        {
            InvalidReferenceException e => new ValidationProblemDetails(
                new Dictionary<string, string[]> { [e.Field] = [e.Message] })
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Une ou plusieurs erreurs de validation sont survenues."
            },
            ConflictException e => new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Conflit avec l'état actuel des données.",
                Detail = e.Message
            },
            // Another request modified the same row between our read and our write: the client can retry.
            DbUpdateConcurrencyException => new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Conflit de concurrence.",
                Detail = "La ressource a été modifiée par une autre requête. Rechargez-la puis réessayez."
            },
            BusinessRuleException e => new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Règle métier non respectée.",
                Detail = e.Message
            },
            _ => null
        };

        if (problem is null)
        {
            return false; // not ours: UseExceptionHandler re-executes /error (500)
        }

        httpContext.Response.StatusCode = problem.Status!.Value;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception
        });
    }
}
