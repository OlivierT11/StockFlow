using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Inventory.Models;

/// <summary>
/// A change of a product's stock in a warehouse. Movements are never updated: they form the stock history.
/// </summary>
public class StockMovement
{
    /// <summary>
    /// Gets or sets the movement identifier.
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the identifier of the moved product.
    /// </summary>
    public int ProductId { get; set; }

    /// <summary>
    /// Gets or sets the moved product.
    /// </summary>
    public Product Product { get; set; } = null!;

    /// <summary>
    /// Gets or sets the identifier of the warehouse where the movement took place.
    /// </summary>
    public int WarehouseId { get; set; }

    /// <summary>
    /// Gets or sets the warehouse where the movement took place.
    /// </summary>
    public Warehouse Warehouse { get; set; } = null!;

    /// <summary>
    /// Gets or sets the movement type.
    /// </summary>
    public StockMovementType Type { get; set; }

    /// <summary>
    /// Gets or sets the quantity: positive for <see cref="StockMovementType.In"/> and <see cref="StockMovementType.Out"/>,
    /// signed (non-zero) for <see cref="StockMovementType.Adjustment"/>.
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Gets or sets the UTC date of the movement.
    /// </summary>
    public DateTime Date { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Gets or sets the identifier of the user who recorded the movement.
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// Gets or sets the user who recorded the movement.
    /// </summary>
    public User User { get; set; } = null!;

    /// <summary>
    /// Gets or sets an optional comment (delivery note number, reason of an adjustment...).
    /// </summary>
    [MaxLength(250)]
    public string? Notes { get; set; }

    /// <summary>
    /// Gets the change applied to <see cref="Product.Stock"/>: <see cref="StockMovementType.Out"/> removes the quantity,
    /// the other types add it (an adjustment quantity can be negative).
    /// </summary>
    [NotMapped]
    public int Delta => Type == StockMovementType.Out ? -Quantity : Quantity;
}

/// <summary>
/// The type of a stock movement. Stored as a string in the database.
/// </summary>
public enum StockMovementType
{
    /// <summary>Entrée : goods received.</summary>
    In,

    /// <summary>Sortie : goods shipped.</summary>
    Out,

    /// <summary>Ajustement : correction after an inventory count (positive or negative).</summary>
    Adjustment
}
