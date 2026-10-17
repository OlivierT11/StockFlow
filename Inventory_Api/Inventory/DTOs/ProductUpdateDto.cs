using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs;

/// <summary>
/// The new data of an existing product.
/// </summary>
public class ProductUpdateDto
{
    /// <summary>
    /// Gets or sets the product identifier.
    /// </summary>
    [Required]
    [Range(1, int.MaxValue)] // validation to ensure Id is positive
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the product name.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; }

    /// <summary>
    /// Gets or sets the unit price.
    /// </summary>
    [Required]
    [Range(0, double.MaxValue)] // validation to ensure price is non-negative
    public decimal Price { get; set; }

    /// <summary>
    /// Gets or sets the stock. Prefer a stock movement, which keeps the history.
    /// </summary>
    [Required]
    [Range(0, int.MaxValue)]
    public int Stock { get; set; }

    /// <summary>
    /// Gets or sets the stock level at or below which the product is reported as low stock (10 by default).
    /// </summary>
    [Range(0, int.MaxValue)]
    public int LowStockThreshold { get; set; } = 10;

    /// <summary>
    /// Gets or sets the identifier of an existing category, or null to leave the product uncategorized.
    /// </summary>
    [Range(1, int.MaxValue)]
    public int? CategoryId { get; set; }
}
