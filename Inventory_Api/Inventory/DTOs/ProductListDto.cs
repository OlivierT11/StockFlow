namespace Inventory.DTOs;

/// <summary>
/// A page of products.
/// </summary>
public class ProductListDto
{
    /// <summary>Gets or sets the products of the requested page.</summary>
    public List<ProductResponseDto> Products { get; set; } = [];

    /// <summary>Gets or sets the number of products matching the filters, all pages included.</summary>
    public int TotalItems { get; set; }

    /// <summary>Gets or sets the number of pages.</summary>
    public int TotalPages { get; set; }
}
