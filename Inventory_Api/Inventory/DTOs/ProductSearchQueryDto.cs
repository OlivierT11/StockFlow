using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs;

/// <summary>
/// The filters, sort and page of a product search (query string of GET /api/v1/products/paged).
/// </summary>
public class ProductSearchQueryDto
{
    /// <summary>Gets or sets the requested page, starting at 1.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "The asked page must be greater than 0.")]
    public int AskedPage { get; set; } = 1; // Default to first page

    /// <summary>Gets or sets the number of products per page (1 to 100).</summary>
    [Range(1, 100, ErrorMessage = "Page size must be greater than 0 and less than or equal to 100.")]
    public int PageSize { get; set; } = 10; // Default page size

    /// <summary>Gets or sets a text that the product name must contain.</summary>
    [RegularExpression("^[a-zA-Z0-9 ]*$", ErrorMessage = "Search product name can only contain letters, numbers, and spaces.")]
    public string? Name { get; set; }

    /// <summary>Gets or sets the minimum price.</summary>
    [Range(typeof(decimal), "0", "1000000", ErrorMessage = "Min price must be greater than or equal to 0.")]
    public decimal MinPrice { get; set; } = 0m;

    /// <summary>Gets or sets the maximum price.</summary>
    [Range(typeof(decimal), "0", "1000000", ErrorMessage = "The requested max price exceeds the maximum allowed value.")]
    public decimal MaxPrice { get; set; } = 1000000m;

    /// <summary>Gets or sets whether to return only the products at or below their low stock threshold.</summary>
    public bool LowStockOnly { get; set; } = false;

    /// <summary>Gets or sets the identifier of the category the products must belong to.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "The category id must be greater than 0.")]
    public int? CategoryId { get; set; }

    /// <summary>Gets or sets the sort field: name, price or stock.</summary>
    [RegularExpression("name|price|stock", ErrorMessage = "SortBy must be 'name', 'price', or 'stock'.")]
    public string SortBy { get; set; } = "name";

    /// <summary>Gets or sets the sort direction: asc or desc.</summary>
    [RegularExpression("asc|desc", ErrorMessage = "SortDirection must be 'asc' or 'desc'.")]
    public string SortDirection { get; set; } = "asc";
}
