using Inventory.DTOs;

namespace Inventory.Services.Interfaces;

/// <summary>
/// Category business logic. Calls the repository.
/// </summary>
public interface ICategoryService
{
    /// <summary>Gets all the categories, sorted by name.</summary>
    Task<List<CategoryResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>Gets a category, or null if it does not exist.</summary>
    Task<CategoryResponseDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Creates a category.</summary>
    Task<CategoryResponseDto> CreateAsync(CategoryRequestDto dto, CancellationToken cancellationToken = default);

    /// <summary>Updates a category; returns false if it does not exist.</summary>
    Task<bool> UpdateAsync(int id, CategoryRequestDto dto, CancellationToken cancellationToken = default);

    /// <summary>Deletes a category; returns false if it does not exist, throws ConflictException if it has products.</summary>
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}
