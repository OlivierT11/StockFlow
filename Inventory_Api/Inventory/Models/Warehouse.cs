using System.ComponentModel.DataAnnotations;

namespace Inventory.Models;

/// <summary>
/// A warehouse where stock movements take place.
/// </summary>
public class Warehouse
{
    /// <summary>
    /// Gets or sets the warehouse identifier.
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the warehouse name.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the warehouse address.
    /// </summary>
    [MaxLength(250)]
    public string? Address { get; set; }

    /// <summary>
    /// Gets or sets the stock movements recorded in the warehouse.
    /// </summary>
    public ICollection<StockMovement> StockMovements { get; set; } = [];
}
