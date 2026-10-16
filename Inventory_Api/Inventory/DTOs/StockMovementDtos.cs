using System.ComponentModel.DataAnnotations;
using Inventory.Models;

namespace Inventory.DTOs;

/// <summary>
/// A stock movement to record (body of POST /api/v1/stock/movements).
/// </summary>
public class StockMovementCreateDto : IValidatableObject
{
    /// <summary>Gets or sets the identifier of the moved product.</summary>
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    /// <summary>Gets or sets the identifier of the warehouse.</summary>
    [Range(1, int.MaxValue)]
    public int WarehouseId { get; set; }

    /// <summary>Gets or sets the movement type: In (entrée), Out (sortie) or Adjustment (ajustement).</summary>
    [Required]
    [EnumDataType(typeof(StockMovementType))]
    public StockMovementType? Type { get; set; }

    /// <summary>
    /// Gets or sets the quantity: greater than 0 for In and Out,
    /// non-zero for Adjustment (negative to remove stock, positive to add some).
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>Gets or sets an optional comment.</summary>
    [MaxLength(250)]
    public string? Notes { get; set; }

    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Type is StockMovementType.In or StockMovementType.Out && Quantity <= 0)
        {
            yield return new ValidationResult(
                "The quantity of an In or Out movement must be greater than 0.",
                [nameof(Quantity)]);
        }

        if (Type is StockMovementType.Adjustment && Quantity == 0)
        {
            yield return new ValidationResult(
                "The quantity of an Adjustment movement cannot be 0.",
                [nameof(Quantity)]);
        }
    }
}

/// <summary>
/// A stock movement returned by the API.
/// </summary>
public class StockMovementResponseDto
{
    /// <summary>Gets or sets the movement identifier.</summary>
    public int Id { get; set; }

    /// <summary>Gets or sets the identifier of the moved product.</summary>
    public int ProductId { get; set; }

    /// <summary>Gets or sets the name of the moved product.</summary>
    public string ProductName { get; set; } = string.Empty;

    /// <summary>Gets or sets the identifier of the warehouse.</summary>
    public int WarehouseId { get; set; }

    /// <summary>Gets or sets the name of the warehouse.</summary>
    public string WarehouseName { get; set; } = string.Empty;

    /// <summary>Gets or sets the movement type.</summary>
    public StockMovementType Type { get; set; }

    /// <summary>Gets or sets the quantity, as it was recorded.</summary>
    public int Quantity { get; set; }

    /// <summary>Gets or sets the change applied to the product stock (negative for an Out movement).</summary>
    public int Delta { get; set; }

    /// <summary>Gets or sets the UTC date of the movement.</summary>
    public DateTime Date { get; set; }

    /// <summary>Gets or sets the identifier of the user who recorded the movement.</summary>
    public int UserId { get; set; }

    /// <summary>Gets or sets the optional comment.</summary>
    public string? Notes { get; set; }
}

/// <summary>
/// The filters and page of a movement list (query string of GET /api/v1/stock/movements and GET /api/v1/products/{id}/movements).
/// Movements are sorted from the most recent to the oldest.
/// </summary>
public class StockMovementQueryDto : IValidatableObject
{
    /// <summary>Gets or sets the identifier of the warehouse the movements must belong to.</summary>
    [Range(1, int.MaxValue)]
    public int? WarehouseId { get; set; }

    /// <summary>Gets or sets the start of the period (UTC, inclusive).</summary>
    public DateTime? From { get; set; }

    /// <summary>Gets or sets the end of the period (UTC, exclusive: to=2026-11-01 returns the whole of October).</summary>
    public DateTime? To { get; set; }

    /// <summary>Gets or sets the requested page, starting at 1.</summary>
    [Range(1, int.MaxValue)]
    public int AskedPage { get; set; } = 1;

    /// <summary>Gets or sets the number of movements per page (1 to 100).</summary>
    [Range(1, 100)]
    public int PageSize { get; set; } = 20;

    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (From is not null && To is not null && From > To)
        {
            yield return new ValidationResult(
                "'From' must be earlier than 'To'.",
                [nameof(From), nameof(To)]);
        }
    }
}

/// <summary>
/// A page of stock movements.
/// </summary>
public class StockMovementListDto
{
    /// <summary>Gets or sets the movements of the requested page.</summary>
    public List<StockMovementResponseDto> Movements { get; set; } = [];

    /// <summary>Gets or sets the number of movements matching the filters, all pages included.</summary>
    public int TotalItems { get; set; }

    /// <summary>Gets or sets the number of pages.</summary>
    public int TotalPages { get; set; }
}
