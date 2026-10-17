namespace Inventory.Exceptions;

// Exceptions thrown by the services when a request cannot be applied.
// ApiExceptionHandler turns each of them into a ProblemDetails response, so the controllers do not need a try/catch.

/// <summary>
/// The request references an entity that does not exist (e.g. an unknown categoryId in the body). Returned as 400.
/// </summary>
/// <param name="field">The name of the request field holding the unknown identifier.</param>
/// <param name="message">The error message shown to the client.</param>
public class InvalidReferenceException(string field, string message) : Exception(message)
{
    /// <summary>
    /// Gets the name of the request field holding the unknown identifier.
    /// </summary>
    public string Field { get; } = field;
}

/// <summary>
/// The request conflicts with the current state of the data (e.g. deleting a category that still has products). Returned as 409.
/// </summary>
/// <param name="message">The error message shown to the client.</param>
public class ConflictException(string message) : Exception(message);

/// <summary>
/// The request is valid but breaks a business rule (e.g. a stock that would become negative). Returned as 422.
/// </summary>
/// <param name="message">The error message shown to the client.</param>
public class BusinessRuleException(string message) : Exception(message);
