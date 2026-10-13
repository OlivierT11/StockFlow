using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs
{
    public class ProductListDto
    {
        public List<ProductResponseDto> Products { get; set; } = [];

        public int TotalItems { get; set; }

        public int TotalPages { get; set; }

    }
}
