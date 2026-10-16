using Inventory.DTOs;
using Inventory.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.Controllers;

/// <summary>
/// Warehouses. Read: any authenticated user. Write: Admin.
/// </summary>
[ApiController]
[Route("api/v1/warehouses")]
[Authorize(Roles = "Admin,User")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public class WarehousesController : ControllerBase
{
    private readonly IWarehouseService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="WarehousesController"/> class.
    /// </summary>
    /// <param name="service">The warehouse service.</param>
    public WarehousesController(IWarehouseService service)
    {
        _service = service;
    }

    /// <summary>
    /// Gets all the warehouses, sorted by name.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The warehouses.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<WarehouseResponseDto>>> GetAll(
        CancellationToken cancellationToken = default)
    {
        return Ok(await _service.GetAllAsync(cancellationToken));
    }

    /// <summary>
    /// Gets a warehouse by its ID.
    /// </summary>
    /// <param name="id">The warehouse identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The warehouse.</returns>
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<WarehouseResponseDto>> GetById(
        int id,
        CancellationToken cancellationToken = default)
    {
        var warehouse = await _service.GetByIdAsync(id, cancellationToken);

        if (warehouse is null)
        {
            return NotFound();
        }

        return Ok(warehouse);
    }

    /// <summary>
    /// Creates a warehouse.
    /// </summary>
    /// <param name="dto">The warehouse data.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The created warehouse.</returns>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<WarehouseResponseDto>> Create(
        WarehouseRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var warehouse = await _service.CreateAsync(dto, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = warehouse.Id }, warehouse);
    }

    /// <summary>
    /// Updates a warehouse.
    /// </summary>
    /// <param name="id">The warehouse identifier.</param>
    /// <param name="dto">The warehouse data.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>No content.</returns>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        int id,
        WarehouseRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        if (!await _service.UpdateAsync(id, dto, cancellationToken))
        {
            return NotFound();
        }

        return NoContent();
    }

    /// <summary>
    /// Deletes a warehouse. Refused (409) once stock movements were recorded in it.
    /// </summary>
    /// <param name="id">The warehouse identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>No content.</returns>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        int id,
        CancellationToken cancellationToken = default)
    {
        if (!await _service.DeleteAsync(id, cancellationToken))
        {
            return NotFound();
        }

        return NoContent();
    }
}
