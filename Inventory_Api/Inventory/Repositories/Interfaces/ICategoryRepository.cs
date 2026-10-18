using Inventory.Models;

namespace Inventory.Repositories.Interfaces;

/// <summary>
/// Database calls for the categories.
/// </summary>
public interface ICategoryRepository
{
    /// <summary>Gets all the categories, sorted by name.</summary>
    Task<List<Category>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>Gets a category by id, or null if it does not exist.</summary>
    Task<Category?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Checks whether a category exists.</summary>
    Task<bool> ExistsAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Creates a category and returns it with its generated id.</summary>
    Task<Category> CreateAsync(Category category, CancellationToken cancellationToken = default);

    /// <summary>Updates a category; returns false if it does not exist (or was deleted by another request).</summary>
    Task<bool> UpdateAsync(int id, Category category, CancellationToken cancellationToken = default);

    /// <summary>Deletes a category; returns false if it does not exist (or was already deleted by another request).</summary>
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Checks whether products belong to the category (a category in use cannot be deleted).</summary>
    Task<bool> HasProductsAsync(int id, CancellationToken cancellationToken = default);
}
