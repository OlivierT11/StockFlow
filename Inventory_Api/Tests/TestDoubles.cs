using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Tests;

/// <summary>
/// A logger that keeps the entries it receives, to check which branch of a method ran
/// (for example "canceled by the caller" logged as information, "timed out" logged as a warning).
/// </summary>
internal sealed class ListLogger<T> : ILogger<T>
{
    public List<(LogLevel Level, string Message)> Entries { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter) =>
        Entries.Add((logLevel, formatter(state, exception)));
}

/// <summary>
/// Assertions on the timeout of the repository template (a timeout CancellationTokenSource linked with the caller's token).
/// </summary>
internal static class TimeoutAssert
{
    /// <summary>
    /// A timeout that has already expired: new CancellationTokenSource(TimeSpan.Zero) is canceled as soon as it is created,
    /// so every database call of a repository built with it times out at once, without making the test wait.
    /// </summary>
    public static readonly TimeSpan Expired = TimeSpan.Zero;

    /// <summary>
    /// Checks that the call throws, and that the repository logged it as a timeout (warning)
    /// rather than as a cancellation by the caller (information).
    /// </summary>
    public static async Task ThrowsAndLogsTimeoutAsync<T>(ListLogger<T> logger, Func<Task> call)
    {
        logger.Entries.Clear();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(call);

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Contains("timed out", entry.Message);
    }
}

/// <summary>
/// Runs a callback once, just before the intercepted context writes to the database.
/// Used to simulate another request committing a change between the repository's read and its SaveChanges.
/// </summary>
internal sealed class BeforeSaveInterceptor(Func<Task> onSaving) : SaveChangesInterceptor
{
    private Func<Task>? _onSaving = onSaving;

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var callback = Interlocked.Exchange(ref _onSaving, null);
        if (callback is not null)
        {
            await callback();
        }

        return result;
    }
}
