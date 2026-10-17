using Inventory.DTOs;

namespace Inventory.Services.Interfaces;

/// <summary>
/// Stock movement business logic. Calls the repository.
/// </summary>
public interface IStockMovementService
{
    /// <summary>
    /// Records a movement and updates the product stock. Throws InvalidReferenceException (unknown product or warehouse),
    /// BusinessRuleException (stock would become negative) or DbUpdateConcurrencyException (product modified meanwhile).
    /// </summary>
    Task<StockMovementResponseDto> CreateAsync(
        StockMovementCreateDto dto,
        int userId,
        CancellationToken cancellationToken = default);

    /// <summary>Gets a page of movements filtered by warehouse and period.</summary>
    Task<StockMovementListDto> GetAsync(
        StockMovementQueryDto query,
        CancellationToken cancellationToken = default);

    /// <summary>Gets a page of the movements of a product, or null if the product does not exist.</summary>
    Task<StockMovementListDto?> GetByProductAsync(
        int productId,
        StockMovementQueryDto query,
        CancellationToken cancellationToken = default);
}
