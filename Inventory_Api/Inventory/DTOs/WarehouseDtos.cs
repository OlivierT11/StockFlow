using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs;

/// <summary>
/// The data of a warehouse to create or update.
/// </summary>
public class WarehouseRequestDto
{
    /// <summary>Gets or sets the warehouse name.</summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets the warehouse address.</summary>
    [MaxLength(250)]
    public string? Address { get; set; }
}

/// <summary>
/// A warehouse returned by the API.
/// </summary>
public class WarehouseResponseDto
{
    /// <summary>Gets or sets the warehouse identifier.</summary>
    public int Id { get; set; }

    /// <summary>Gets or sets the warehouse name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets the warehouse address.</summary>
    public string? Address { get; set; }
}
