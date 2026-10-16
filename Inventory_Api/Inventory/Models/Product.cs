using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Inventory.Models;

/// <summary>
/// A product of the catalog. Its <see cref="Stock"/> is changed by <see cref="StockMovement"/> records.
/// </summary>
public class Product
{
    /// <summary>
    /// Gets or sets the product identifier.
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the product name.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the unit price.
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }

    /// <summary>
    /// Gets or sets the quantity in stock, all warehouses included.
    /// </summary>
    public int Stock { get; set; }

    /// <summary>
    /// Gets or sets the stock level at or below which the product is reported as low stock.
    /// </summary>
    public int LowStockThreshold { get; set; } = 10;

    /// <summary>
    /// Gets or sets the identifier of the product category, or null if the product is not categorized.
    /// Nullable so that the products created before categories existed stay valid.
    /// </summary>
    public int? CategoryId { get; set; }

    /// <summary>
    /// Gets or sets the product category.
    /// </summary>
    public Category? Category { get; set; }

    /// <summary>
    /// Gets or sets the stock movements of the product.
    /// </summary>
    public ICollection<StockMovement> StockMovements { get; set; } = [];

    /// <summary>
    /// Concurrency token (SQL Server rowversion) for optimistic concurrency control.
    /// </summary>
    [Timestamp]
    public byte[] Version { get; set; } = Array.Empty<byte>();
}