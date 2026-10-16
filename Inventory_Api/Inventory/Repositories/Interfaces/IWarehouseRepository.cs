using Inventory.Models;

namespace Inventory.Repositories.Interfaces;

/// <summary>
/// Database calls for the warehouses.
/// </summary>
public interface IWarehouseRepository
{
    /// <summary>Gets all the warehouses, sorted by name.</summary>
    Task<List<Warehouse>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>Gets a warehouse by id, or null if it does not exist.</summary>
    Task<Warehouse?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Checks whether a warehouse exists.</summary>
    Task<bool> ExistsAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Creates a warehouse and returns it with its generated id.</summary>
    Task<Warehouse> CreateAsync(Warehouse warehouse, CancellationToken cancellationToken = default);

    /// <summary>Updates a warehouse; returns false if it does not exist (or was deleted by another request).</summary>
    Task<bool> UpdateAsync(int id, Warehouse warehouse, CancellationToken cancellationToken = default);

    /// <summary>Deletes a warehouse; returns false if it does not exist (or was already deleted by another request).</summary>
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Checks whether stock movements were recorded in the warehouse (a warehouse with a history cannot be deleted).</summary>
    Task<bool> HasMovementsAsync(int id, CancellationToken cancellationToken = default);
}
