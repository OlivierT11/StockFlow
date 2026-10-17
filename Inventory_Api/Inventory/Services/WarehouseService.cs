using Inventory.DTOs;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Inventory.Services;

/// <summary>
/// Warehouse business rules: maps the DTOs to the model and refuses to delete a warehouse with a stock history.
/// </summary>
public class WarehouseService : IWarehouseService
{
    private readonly IWarehouseRepository _warehouseRepository;

    /// <summary>
    /// Initializes a new instance of the <see cref="WarehouseService"/> class.
    /// </summary>
    /// <param name="warehouseRepository">The warehouse repository.</param>
    public WarehouseService(IWarehouseRepository warehouseRepository)
    {
        _warehouseRepository = warehouseRepository;
    }

    /// <inheritdoc />
    public async Task<List<WarehouseResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var warehouses = await _warehouseRepository.GetAllAsync(cancellationToken);
        return warehouses.Select(ToResponseDto).ToList();
    }

    /// <inheritdoc />
    public async Task<WarehouseResponseDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var warehouse = await _warehouseRepository.GetByIdAsync(id, cancellationToken);
        return warehouse is null ? null : ToResponseDto(warehouse);
    }

    /// <inheritdoc />
    public async Task<WarehouseResponseDto> CreateAsync(WarehouseRequestDto dto, CancellationToken cancellationToken = default)
    {
        var created = await _warehouseRepository.CreateAsync(
            new Warehouse { Name = dto.Name, Address = dto.Address },
            cancellationToken);

        return ToResponseDto(created);
    }

    /// <inheritdoc />
    public async Task<bool> UpdateAsync(int id, WarehouseRequestDto dto, CancellationToken cancellationToken = default)
    {
        return await _warehouseRepository.UpdateAsync(
            id,
            new Warehouse { Id = id, Name = dto.Name, Address = dto.Address },
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        if (await _warehouseRepository.HasMovementsAsync(id, cancellationToken))
        {
            throw new ConflictException(
                $"L'entrepôt {id} a des mouvements de stock : il ne peut pas être supprimé.");
        }

        return await _warehouseRepository.DeleteAsync(id, cancellationToken);
    }

    private static WarehouseResponseDto ToResponseDto(Warehouse warehouse) => new()
    {
        Id = warehouse.Id,
        Name = warehouse.Name,
        Address = warehouse.Address
    };
}
