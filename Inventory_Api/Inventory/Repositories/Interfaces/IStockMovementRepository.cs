using Inventory.DTOs;
using Inventory.Models;

namespace Inventory.Repositories.Interfaces;

/// <summary>
/// Database calls for the stock movements.
/// </summary>
public interface IStockMovementRepository
{
    /// <summary>
    /// Records a movement and updates the product stock in one transaction.
    /// Throws DbUpdateConcurrencyException if the product was modified by another request meanwhile (nothing is saved).
    /// </summary>
    Task<StockMovementCreateResult> CreateAsync(
        StockMovement movement,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a page of movements, most recent first, optionally restricted to one product.
    /// </summary>
    Task<StockMovementListDto> GetPagedAsync(
        StockMovementQueryDto query,
        int? productId = null,
        CancellationToken cancellationToken = default);
}
