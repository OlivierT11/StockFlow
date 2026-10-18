using Inventory.DTOs;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Inventory.Services;

/// <summary>
/// Stock movement business rules: builds the movement, turns the repository outcome into API errors.
/// </summary>
public class StockMovementService : IStockMovementService
{
    private readonly IStockMovementRepository _stockMovementRepository;
    private readonly IProductRepository _productRepository;

    /// <summary>
    /// Initializes a new instance of the <see cref="StockMovementService"/> class.
    /// </summary>
    /// <param name="stockMovementRepository">The stock movement repository.</param>
    /// <param name="productRepository">The product repository, used to check the product of a movement list.</param>
    public StockMovementService(
        IStockMovementRepository stockMovementRepository,
        IProductRepository productRepository)
    {
        _stockMovementRepository = stockMovementRepository;
        _productRepository = productRepository;
    }

    /// <inheritdoc />
    public async Task<StockMovementResponseDto> CreateAsync(
        StockMovementCreateDto dto,
        int userId,
        CancellationToken cancellationToken = default)
    {
        var movement = new StockMovement
        {
            ProductId = dto.ProductId,
            WarehouseId = dto.WarehouseId,
            Type = dto.Type!.Value, // [Required]: model validation rejected a missing type
            Quantity = dto.Quantity,
            Date = DateTime.UtcNow, // set by the server: a movement cannot be backdated
            UserId = userId,
            Notes = dto.Notes
        };

        var result = await _stockMovementRepository.CreateAsync(movement, cancellationToken);

        return result.Outcome switch
        {
            StockMovementOutcome.Created => result.Movement!,
            StockMovementOutcome.ProductNotFound => throw new InvalidReferenceException(
                nameof(dto.ProductId),
                $"Le produit {dto.ProductId} n'existe pas."),
            StockMovementOutcome.WarehouseNotFound => throw new InvalidReferenceException(
                nameof(dto.WarehouseId),
                $"L'entrepôt {dto.WarehouseId} n'existe pas."),
            StockMovementOutcome.InsufficientStock => throw new BusinessRuleException(
                $"Stock insuffisant : ce mouvement rendrait le stock du produit {dto.ProductId} négatif."),
            _ => throw new InvalidOperationException($"Unexpected outcome {result.Outcome}.")
        };
    }

    /// <inheritdoc />
    public async Task<StockMovementListDto> GetAsync(
        StockMovementQueryDto query,
        CancellationToken cancellationToken = default)
    {
        return await _stockMovementRepository.GetPagedAsync(
            NormalizePeriod(query),
            productId: null,
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task<StockMovementListDto?> GetByProductAsync(
        int productId,
        StockMovementQueryDto query,
        CancellationToken cancellationToken = default)
    {
        if (await _productRepository.GetByIdAsync(productId, cancellationToken) is null)
        {
            return null;
        }

        return await _stockMovementRepository.GetPagedAsync(
            NormalizePeriod(query),
            productId,
            cancellationToken);
    }

    /// <summary>
    /// The movement dates are stored in UTC. Model binding turns "2026-10-01T00:00:00Z" into a local time
    /// and leaves "2026-10-01" unspecified: both are converted to UTC (an unspecified date is taken as UTC).
    /// </summary>
    private static StockMovementQueryDto NormalizePeriod(StockMovementQueryDto query)
    {
        query.From = ToUtc(query.From);
        query.To = ToUtc(query.To);
        return query;
    }

    private static DateTime? ToUtc(DateTime? date) => date?.Kind switch
    {
        DateTimeKind.Local => date.Value.ToUniversalTime(),
        DateTimeKind.Unspecified => DateTime.SpecifyKind(date.Value, DateTimeKind.Utc),
        _ => date
    };
}
