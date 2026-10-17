using Inventory.Data;
using Inventory.Models;
using Inventory.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Repositories;

/// <summary>
/// Database calls for the warehouses. Every call is canceled after a timeout (10 s by default) or when the caller cancels.
/// </summary>
public class WarehouseRepository : IWarehouseRepository
{
    private readonly AppDbContext _context;
    private readonly ILogger<WarehouseRepository> _logger;
    private readonly TimeSpan _timeout;

    /// <summary>
    /// Initializes a new instance of the <see cref="WarehouseRepository"/> class.
    /// </summary>
    /// <param name="context">The database context.</param>
    /// <param name="logger">The logger.</param>
    /// <param name="timeout">The timeout of each database call (10 s by default).</param>
    public WarehouseRepository(
        AppDbContext context,
        ILogger<WarehouseRepository> logger,
        TimeSpan? timeout = null)
    {
        _context = context;
        _logger = logger;
        _timeout = timeout ?? TimeSpan.FromSeconds(10);
    }

    /// <inheritdoc />
    public async Task<List<Warehouse>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        // timeout token
        using var timeoutCts = new CancellationTokenSource(_timeout);

        // link the cancellation token with the timeout token
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            return await _context.Warehouses
                .AsNoTracking()
                .OrderBy(warehouse => warehouse.Name)
                .ToListAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Get warehouses was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Get warehouses timed out");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<Warehouse?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            return await _context.Warehouses
                .AsNoTracking()
                .FirstOrDefaultAsync(warehouse => warehouse.Id == id, linkedCts.Token);
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Get warehouse was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Get warehouse timed out");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<bool> ExistsAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            return await _context.Warehouses
                .AnyAsync(warehouse => warehouse.Id == id, linkedCts.Token);
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Check warehouse existence was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Check warehouse existence timed out");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<Warehouse> CreateAsync(
        Warehouse warehouse,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            _context.Warehouses.Add(warehouse);
            await _context.SaveChangesAsync(linkedCts.Token);

            return warehouse;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Create warehouse was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Create warehouse timed out");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<bool> UpdateAsync(
        int id,
        Warehouse warehouse,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            var stored = await _context.Warehouses
                .FirstOrDefaultAsync(w => w.Id == id, linkedCts.Token);

            if (stored is null)
            {
                return false;
            }

            stored.Name = warehouse.Name;
            stored.Address = warehouse.Address;

            try
            {
                await _context.SaveChangesAsync(linkedCts.Token);
            }
            catch (DbUpdateConcurrencyException)
            {
                // No concurrency token on this table: the only possible conflict is a row deleted by another request.
                _context.Entry(stored).State = EntityState.Detached;

                _logger.LogInformation(
                    "Update warehouse was skipped: the warehouse was deleted by another request");

                return false;
            }

            return true;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Update warehouse was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Update warehouse timed out");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            var stored = await _context.Warehouses
                .FirstOrDefaultAsync(w => w.Id == id, linkedCts.Token);

            if (stored is null)
            {
                return false;
            }

            _context.Warehouses.Remove(stored);

            try
            {
                await _context.SaveChangesAsync(linkedCts.Token);
            }
            catch (DbUpdateConcurrencyException)
            {
                // The row was deleted by another request after it was loaded.
                _context.Entry(stored).State = EntityState.Detached;

                _logger.LogInformation(
                    "Delete warehouse was skipped: the warehouse was already deleted by another request");

                return false;
            }

            return true;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Delete warehouse was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Delete warehouse timed out");
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<bool> HasMovementsAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            return await _context.StockMovements
                .AnyAsync(x => x.WarehouseId == id, linkedCts.Token);
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Check warehouse movements was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Check warehouse movements timed out");
            throw;
        }
    }
}
