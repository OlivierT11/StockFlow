using Inventory.DTOs;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Inventory.Services
{
    /// <summary>
    /// Category business rules: maps the DTOs to the model and refuses to delete a category in use.
    /// </summary>
    public class CategoryService : ICategoryService
    {
        private readonly ICategoryRepository _categoryRepository;

        /// <summary>
        /// Initializes a new instance of the <see cref="CategoryService"/> class.
        /// </summary>
        /// <param name="categoryRepository">The category repository.</param>
        public CategoryService(ICategoryRepository categoryRepository)
        {
            _categoryRepository = categoryRepository;
        }

        /// <inheritdoc />
        public async Task<List<CategoryResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            var categories = await _categoryRepository.GetAllAsync(cancellationToken);
            return categories.Select(ToResponseDto).ToList();
        }

        /// <inheritdoc />
        public async Task<CategoryResponseDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            var category = await _categoryRepository.GetByIdAsync(id, cancellationToken);
            return category is null ? null : ToResponseDto(category);
        }

        /// <inheritdoc />
        public async Task<CategoryResponseDto> CreateAsync(CategoryRequestDto dto, CancellationToken cancellationToken = default)
        {
            var created = await _categoryRepository.CreateAsync(
                new Category { Name = dto.Name },
                cancellationToken);

            return ToResponseDto(created);
        }

        /// <inheritdoc />
        public async Task<bool> UpdateAsync(int id, CategoryRequestDto dto, CancellationToken cancellationToken = default)
        {
            return await _categoryRepository.UpdateAsync(
                id,
                new Category { Id = id, Name = dto.Name },
                cancellationToken);
        }

        /// <inheritdoc />
        public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
        {
            if (await _categoryRepository.HasProductsAsync(id, cancellationToken))
            {
                throw new ConflictException(
                    $"La catégorie {id} contient des produits : réaffectez-les avant de la supprimer.");
            }

            return await _categoryRepository.DeleteAsync(id, cancellationToken);
        }

        private static CategoryResponseDto ToResponseDto(Category category) => new()
        {
            Id = category.Id,
            Name = category.Name
        };
    }
}
