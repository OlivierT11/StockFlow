using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs;

/// <summary>
/// The data of a product to create.
/// </summary>
public class ProductCreateDto
{
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
    /// Gets or sets the initial stock.
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
