using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Linq.Expressions;
using Inventory.Repositories.Interfaces;

namespace Inventory.Repositories;

/// <summary>
/// Database calls for the stock movements. Every call is canceled after a timeout (10 s by default) or when the caller cancels.
/// </summary>
public class StockMovementRepository : IStockMovementRepository
{
    private readonly AppDbContext _context;
    private readonly ILogger<StockMovementRepository> _logger;
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _timeout;

    /// <summary>
    /// Initializes a new instance of the <see cref="StockMovementRepository"/> class.
    /// </summary>
    /// <param name="context">The database context.</param>
    /// <param name="logger">The logger.</param>
    /// <param name="cache">The cache holding the products and the dashboard, evicted after each movement.</param>
    /// <param name="timeout">The timeout of each database call (10 s by default).</param>
    public StockMovementRepository(
        AppDbContext context,
        ILogger<StockMovementRepository> logger,
        IMemoryCache cache,
        TimeSpan? timeout = null)
    {
        _context = context;
        _logger = logger;
        _cache = cache;
        _timeout = timeout ?? TimeSpan.FromSeconds(10);
    }

    /// <summary>
    /// Records a stock movement and applies it to the product stock, in a single transaction:
    /// the movement is inserted, then Product.Stock is updated; if either step fails, neither is kept.
    /// </summary>
    /// <param name="movement">The movement to record (ProductId, WarehouseId, Type, Quantity, Date, UserId, Notes).</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The outcome and, when the movement was created, the created movement.</returns>
    /// <exception cref="DbUpdateConcurrencyException">The product was modified by another request after it was read. Nothing was saved.</exception>
    public async Task<StockMovementCreateResult> CreateAsync(
        StockMovement movement,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            // EnableRetryOnFailure (Program.cs) refuses user transactions opened outside an execution strategy:
            // the strategy replays the whole block, transaction included, after a transient SQL error.
            var strategy = _context.Database.CreateExecutionStrategy();

            var result = await strategy.ExecuteAsync(async () =>
            {
                // A replay starts from a clean change tracker, otherwise the movement and the stock change
                // of the failed attempt would still be tracked and saved twice.
                _context.ChangeTracker.Clear();

                // Disposed without commit (return, exception) = rolled back.
                await using var transaction = await _context.Database.BeginTransactionAsync(linkedCts.Token);

                var product = await _context.Products
                    .FirstOrDefaultAsync(p => p.Id == movement.ProductId, linkedCts.Token);

                if (product is null)
                {
                    return new StockMovementCreateResult(StockMovementOutcome.ProductNotFound);
                }

                var warehouse = await _context.Warehouses
                    .FirstOrDefaultAsync(w => w.Id == movement.WarehouseId, linkedCts.Token);

                if (warehouse is null)
                {
                    return new StockMovementCreateResult(StockMovementOutcome.WarehouseNotFound);
                }

                var created = new StockMovement
                {
                    ProductId = product.Id,
                    WarehouseId = warehouse.Id,
                    Type = movement.Type,
                    Quantity = movement.Quantity,
                    Date = movement.Date,
                    UserId = movement.UserId,
                    Notes = movement.Notes
                };

                var newStock = product.Stock + created.Delta;

                if (newStock < 0)
                {
                    return new StockMovementCreateResult(StockMovementOutcome.InsufficientStock);
                }

                // 1. Insert the movement.
                _context.StockMovements.Add(created);
                await _context.SaveChangesAsync(linkedCts.Token);

                // 2. Update the stock. The UPDATE checks Product.Version: if another request changed the product
                // since it was read above, EF throws DbUpdateConcurrencyException and the movement inserted in step 1
                // is rolled back with the transaction.
                product.Stock = newStock;
                await _context.SaveChangesAsync(linkedCts.Token);

                await transaction.CommitAsync(linkedCts.Token);

                // created.Product and created.Warehouse were set by EF (both are tracked by this context).
                return new StockMovementCreateResult(
                    StockMovementOutcome.Created,
                    StockMovementProjections.ToResponseDtoCompiled(created));
            });

            if (result.Outcome == StockMovementOutcome.Created)
            {
                // The cached product and dashboard show the old stock.
                _cache.Remove(CacheKeys.Product(movement.ProductId));
                _cache.Remove(CacheKeys.Dashboard);
            }

            return result;
        }
        catch (DbUpdateConcurrencyException)
        {
            // Detach the rejected movement and stock change so that a later SaveChanges on this context does not retry them.
            _context.ChangeTracker.Clear();

            _logger.LogInformation(
                "Create stock movement was rejected: product {ProductId} was modified by another request",
                movement.ProductId);

            throw;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Create stock movement was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Create stock movement timed out");
            throw;
        }
    }

    /// <summary>
    /// Gets a page of movements, most recent first, filtered by product, warehouse and period.
    /// </summary>
    /// <param name="query">The filters (warehouse, UTC period) and the page.</param>
    /// <param name="productId">The product the movements must belong to, or null for all products.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The requested page and the paging metadata.</returns>
    public async Task<StockMovementListDto> GetPagedAsync(
        StockMovementQueryDto query,
        int? productId = null,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            var movements = _context.StockMovements
                .AsNoTracking();

            if (productId is not null)
            {
                movements = movements.Where(m => m.ProductId == productId);
            }

            if (query.WarehouseId is not null)
            {
                movements = movements.Where(m => m.WarehouseId == query.WarehouseId);
            }

            if (query.From is not null)
            {
                movements = movements.Where(m => m.Date >= query.From);
            }

            if (query.To is not null)
            {
                movements = movements.Where(m => m.Date < query.To);
            }

            var totalItems = await movements.CountAsync(linkedCts.Token);
            var totalPages = (int)Math.Ceiling(totalItems / (double)query.PageSize);

            var page = await movements
                .OrderByDescending(m => m.Date)
                .ThenByDescending(m => m.Id) // stable order for movements recorded at the same time
                .Skip((query.AskedPage - 1) * query.PageSize)
                .Take(query.PageSize)
                .Select(StockMovementProjections.ToResponseDto)
                .ToListAsync(linkedCts.Token);

            return new StockMovementListDto
            {
                Movements = page,
                TotalItems = totalItems,
                TotalPages = totalPages
            };
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Get stock movements was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Get stock movements timed out");
            throw;
        }
    }
}

/// <summary>
/// The outcome of <see cref="IStockMovementRepository.CreateAsync"/>.
/// </summary>
public enum StockMovementOutcome
{
    /// <summary>The movement was recorded and the stock updated.</summary>
    Created,

    /// <summary>The product does not exist. Nothing was saved.</summary>
    ProductNotFound,

    /// <summary>The warehouse does not exist. Nothing was saved.</summary>
    WarehouseNotFound,

    /// <summary>The movement would make the stock negative. Nothing was saved.</summary>
    InsufficientStock
}

/// <summary>
/// The result of <see cref="IStockMovementRepository.CreateAsync"/>.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Movement">The created movement, when <paramref name="Outcome"/> is <see cref="StockMovementOutcome.Created"/>.</param>
public sealed record StockMovementCreateResult(
    StockMovementOutcome Outcome,
    StockMovementResponseDto? Movement = null);

/// <summary>
/// Stock movement projection shared by the queries (translated to SQL with the product and warehouse joins).
/// </summary>
public static class StockMovementProjections
{
    /// <summary>
    /// Projects a movement to the DTO returned by the API.
    /// </summary>
    public static readonly Expression<Func<StockMovement, StockMovementResponseDto>> ToResponseDto = m => new StockMovementResponseDto
    {
        Id = m.Id,
        ProductId = m.ProductId,
        ProductName = m.Product.Name,
        WarehouseId = m.WarehouseId,
        WarehouseName = m.Warehouse.Name,
        Type = m.Type,
        Quantity = m.Quantity,
        // StockMovement.Delta cannot be translated to SQL, hence the same rule written inline.
        Delta = m.Type == StockMovementType.Out ? -m.Quantity : m.Quantity,
        Date = m.Date,
        UserId = m.UserId,
        Notes = m.Notes
    };

    /// <summary>
    /// The same projection, compiled to map an entity already in memory (its Product and Warehouse must be loaded).
    /// </summary>
    public static readonly Func<StockMovement, StockMovementResponseDto> ToResponseDtoCompiled = ToResponseDto.Compile();
}
