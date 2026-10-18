using Inventory.DTOs;
using Inventory.Services;
using Inventory.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.Controllers;

/// <summary>
/// Inventory summary for the home page of the client.
/// </summary>
[ApiController]
[Route("api/v1/dashboard")]
[Authorize(Roles = "Admin,User")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="DashboardController"/> class.
    /// </summary>
    /// <param name="service">The dashboard service.</param>
    public DashboardController(IDashboardService service)
    {
        _service = service;
    }

    /// <summary>
    /// Gets the number of products, the stock value, the low stock products and the latest movements.
    /// Cached for 60 seconds; a stock movement or a product change refreshes it immediately.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The dashboard.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardDto>> Get(
        CancellationToken cancellationToken = default)
    {
        return Ok(await _service.GetAsync(cancellationToken));
    }
}
