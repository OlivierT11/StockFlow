using System.ComponentModel.DataAnnotations;

namespace Inventory.Models;

/// <summary>
/// A product category.
/// </summary>
public class Category
{
    /// <summary>
    /// Gets or sets the category identifier.
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the category name.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the products of the category.
    /// </summary>
    public ICollection<Product> Products { get; set; } = [];
}
