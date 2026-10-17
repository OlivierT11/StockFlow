using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs;

/// <summary>
/// The data of a category to create or update.
/// </summary>
public class CategoryRequestDto
{
    /// <summary>Gets or sets the category name.</summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// A category returned by the API.
/// </summary>
public class CategoryResponseDto
{
    /// <summary>Gets or sets the category identifier.</summary>
    public int Id { get; set; }

    /// <summary>Gets or sets the category name.</summary>
    public string Name { get; set; } = string.Empty;
}
