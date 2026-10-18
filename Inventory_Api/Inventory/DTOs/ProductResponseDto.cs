namespace Inventory.DTOs;

/// <summary>
/// A product returned by the API.
/// </summary>
public class ProductResponseDto
{
    /// <summary>Gets or sets the product identifier.</summary>
    public int Id { get; set; }

    /// <summary>Gets or sets the product name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets the unit price.</summary>
    public decimal Price { get; set; }

    /// <summary>Gets or sets the quantity in stock.</summary>
    public int Stock { get; set; }

    /// <summary>Gets or sets the stock level at or below which the product is reported as low stock.</summary>
    public int LowStockThreshold { get; set; }

    /// <summary>Gets or sets the category identifier, or null if the product is not categorized.</summary>
    public int? CategoryId { get; set; }

    /// <summary>Gets or sets the category name, or null if the product is not categorized.</summary>
    public string? CategoryName { get; set; }
}
