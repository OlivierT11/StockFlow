namespace Inventory.DTOs;

/// <summary>
/// The inventory summary returned by GET /api/v1/dashboard. Cached for 60 seconds, refreshed after each stock movement.
/// </summary>
public class DashboardDto
{
    /// <summary>Gets or sets the number of products.</summary>
    public int ProductCount { get; set; }

    /// <summary>Gets or sets the value of the stock: sum of price × stock over all products.</summary>
    public decimal TotalStockValue { get; set; }

    /// <summary>Gets or sets the number of products at or below their low stock threshold.</summary>
    public int LowStockProductCount { get; set; }

    /// <summary>Gets or sets the products at or below their threshold with the lowest stock (at most 10; see GET /api/v1/products/low-stock for all).</summary>
    public List<ProductResponseDto> LowStockProducts { get; set; } = [];

    /// <summary>Gets or sets the 10 most recent stock movements.</summary>
    public List<StockMovementResponseDto> RecentMovements { get; set; } = [];

    /// <summary>Gets or sets the UTC date at which these figures were computed (they can be up to 60 seconds old).</summary>
    public DateTime GeneratedAtUtc { get; set; }
}
