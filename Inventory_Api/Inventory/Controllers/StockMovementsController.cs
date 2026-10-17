using Inventory.DTOs;
using Inventory.Services.Interfaces;
using Inventory.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.Controllers;

/// <summary>
/// Stock movements (entrées, sorties, ajustements). Recording movements is the daily work of every user, not only of the admins.
/// </summary>
[ApiController]
[Route("api/v1/stock/movements")]
[Authorize(Roles = "Admin,User")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public class StockMovementsController : ControllerBase
{
    private readonly IStockMovementService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="StockMovementsController"/> class.
    /// </summary>
    /// <param name="service">The stock movement service.</param>
    public StockMovementsController(IStockMovementService service)
    {
        _service = service;
    }

    /// <summary>
    /// Records a stock movement and updates the product stock, in a single transaction.
    /// </summary>
    /// <remarks>
    /// 400: invalid body, or unknown product / warehouse.
    /// 409: the product was modified by another request at the same time; nothing was saved, the request can be retried.
    /// 422: the stock would become negative; nothing was saved.
    /// </remarks>
    /// <param name="dto">The movement.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The recorded movement.</returns>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<StockMovementResponseDto>> Create(
        StockMovementCreateDto dto,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        // Business errors (400 unknown reference, 409, 422) are thrown by the service and turned into ProblemDetails by ApiExceptionHandler.
        var movement = await _service.CreateAsync(dto, userId.Value, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, movement);
    }

    /// <summary>
    /// Gets a page of movements, most recent first, filtered by warehouse and by period.
    /// </summary>
    /// <param name="query">The filters and the page.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The requested page.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<StockMovementListDto>> Get(
        [FromQuery] StockMovementQueryDto query,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _service.GetAsync(query, cancellationToken));
    }

    /// <summary>
    /// Gets a page of the movements of a product, most recent first.
    /// </summary>
    /// <param name="productId">The product identifier.</param>
    /// <param name="query">The filters and the page.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The requested page.</returns>
    [HttpGet("/api/v1/products/{productId:int}/movements")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StockMovementListDto>> GetByProduct(
        int productId,
        [FromQuery] StockMovementQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var movements = await _service.GetByProductAsync(productId, query, cancellationToken);

        if (movements is null)
        {
            return NotFound();
        }

        return Ok(movements);
    }
}
