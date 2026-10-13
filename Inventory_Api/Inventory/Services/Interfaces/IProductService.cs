using Inventory.DTOs;
using Inventory.Models;

namespace Inventory.Services
{
    // Handles business logic. Calls the repository
    public interface IProductService
    {
        Task<List<ProductResponseDto>> GetAllAsync(
            CancellationToken cancellationToken = default);

        Task<ProductListDto> GetWithPagerAsync(
            ProductSearchQueryDto query,
            CancellationToken cancellationToken = default);

        Task<ProductResponseDto?> GetByIdAsync(
            int id,
            CancellationToken cancellationToken = default);

        Task<ProductResponseDto> CreateAsync(
            ProductCreateDto dto,
            CancellationToken cancellationToken = default);

        Task<bool> UpdateAsync(
            int id,
            ProductUpdateDto dto,
            CancellationToken cancellationToken = default);

        Task<bool> DeleteAsync(
            int id,
            CancellationToken cancellationToken = default);
    }
}
