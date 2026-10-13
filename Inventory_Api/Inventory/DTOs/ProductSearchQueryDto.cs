using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs
{
    public class ProductSearchQueryDto
    {
        public List<ProductResponseDto> Products { get; set; } = new List<ProductResponseDto>();

        [Range(1, int.MaxValue, ErrorMessage = "The asked page must be greater than 0.")]
        public int AskedPage { get; set; } = 1; // Default to first page

        [Range(1, 100, ErrorMessage = "Page size must be greater than 0 and less than or equal to 100.")]
        public int PageSize { get; set; } = 10; // Default page size

        [RegularExpression("^[a-zA-Z0-9 ]*$", ErrorMessage = "Search product name can only contain letters, numbers, and spaces.")]
        public string Name { get; set; }

        [Range(typeof(decimal), "0", "1000000", ErrorMessage = "Min price must be greater than or equal to 0.")]
        public decimal MinPrice { get; set; } = 0m;

        [Range(typeof(decimal), "0", "1000000", ErrorMessage = "The requested max price exceeds the maximum allowed value.")]
        public decimal MaxPrice { get; set; } = 1000000m; 

        public bool LowStockOnly { get; set; } = false; 

        [RegularExpression("name|price|stock", ErrorMessage = "SortBy must be 'name', 'price', or 'stock'.")]
        public string SortBy { get; set; } = "name";

        [RegularExpression("asc|desc", ErrorMessage = "SortDirection must be 'asc' or 'desc'.")]
        public string SortDirection { get; set; } = "asc"; 
    }
}
