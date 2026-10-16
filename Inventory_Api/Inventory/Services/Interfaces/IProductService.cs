using Inventory.DTOs;

namespace Inventory.Services.Interfaces;

/// <summary>
/// Product business logic. Calls the repository.
/// </summary>
public interface IProductService
{
    /// <summary>Gets all the products.</summary>
    Task<List<ProductResponseDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    /// <summary>Gets a page of products matching the filters, sorted as requested.</summary>
    Task<ProductListDto> GetWithPagerAsync(
        ProductSearchQueryDto query,
        CancellationToken cancellationToken = default);

    /// <summary>Gets the products at or below their low stock threshold, lowest stock first.</summary>
    Task<List<ProductResponseDto>> GetLowStockAsync(
        CancellationToken cancellationToken = default);

    /// <summary>Gets a product, or null if it does not exist.</summary>
    Task<ProductResponseDto?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default);

    /// <summary>Creates a product; throws InvalidReferenceException if its category does not exist.</summary>
    Task<ProductResponseDto> CreateAsync(
        ProductCreateDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a product; returns false if it does not exist. Throws InvalidReferenceException if its category does not exist,
    /// DbUpdateConcurrencyException if it was modified by another request.
    /// </summary>
    Task<bool> UpdateAsync(
        int id,
        ProductUpdateDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a product; returns false if it does not exist. Throws ConflictException if it has stock movements,
    /// DbUpdateConcurrencyException if it was modified by another request.
    /// </summary>
    Task<bool> DeleteAsync(
        int id,
        CancellationToken cancellationToken = default);
}
