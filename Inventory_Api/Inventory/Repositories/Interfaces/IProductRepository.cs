using Inventory.DTOs;
using Inventory.Models;

namespace Inventory.Repositories.Interfaces;

/// <summary>
/// Database calls for the products.
/// </summary>
public interface IProductRepository
{
    /// <summary>Gets a product (cached 5 minutes), or null if it does not exist.</summary>
    Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Gets all the products.</summary>
    Task<List<Product>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>Gets a page of products matching the filters, sorted as requested.</summary>
    Task<ProductListDto> GetWithPagerAsync(ProductSearchQueryDto query, CancellationToken cancellationToken = default);

    /// <summary>Creates a product and returns it with its generated id and its category name.</summary>
    Task<Product> CreateAsync(Product product, CancellationToken cancellationToken = default);

    /// <summary>Updates a product; returns false if it does not exist (or was deleted by another request).</summary>
    Task<bool> UpdateAsync(int id, Product product, CancellationToken cancellationToken = default);

    /// <summary>Deletes a product; returns false if it does not exist (or was already deleted by another request).</summary>
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Gets the products at or below their low stock threshold, lowest stock first.</summary>
    Task<List<ProductResponseDto>> GetLowStockAsync(CancellationToken cancellationToken = default);

    /// <summary>Checks whether stock movements reference the product.</summary>
    Task<bool> HasMovementsAsync(int id, CancellationToken cancellationToken = default);
}
