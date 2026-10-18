using Inventory.DTOs;

namespace Inventory.Services.Interfaces;

/// <summary>
/// Warehouse business logic. Calls the repository.
/// </summary>
public interface IWarehouseService
{
    /// <summary>Gets all the warehouses, sorted by name.</summary>
    Task<List<WarehouseResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>Gets a warehouse, or null if it does not exist.</summary>
    Task<WarehouseResponseDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Creates a warehouse.</summary>
    Task<WarehouseResponseDto> CreateAsync(WarehouseRequestDto dto, CancellationToken cancellationToken = default);

    /// <summary>Updates a warehouse; returns false if it does not exist.</summary>
    Task<bool> UpdateAsync(int id, WarehouseRequestDto dto, CancellationToken cancellationToken = default);

    /// <summary>Deletes a warehouse; returns false if it does not exist, throws ConflictException if it has movements.</summary>
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}
