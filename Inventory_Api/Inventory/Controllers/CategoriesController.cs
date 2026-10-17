using Inventory.DTOs;
using Inventory.Services;
using Inventory.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.Controllers;

/// <summary>
/// Product categories. Read: any authenticated user. Write: Admin.
/// </summary>
[ApiController]
[Route("api/v1/categories")]
[Authorize(Roles = "Admin,User")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="CategoriesController"/> class.
    /// </summary>
    /// <param name="service">The category service.</param>
    public CategoriesController(ICategoryService service)
    {
        _service = service;
    }

    /// <summary>
    /// Gets all the categories, sorted by name.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The categories.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CategoryResponseDto>>> GetAll(
        CancellationToken cancellationToken = default)
    {
        return Ok(await _service.GetAllAsync(cancellationToken));
    }

    /// <summary>
    /// Gets a category by its ID.
    /// </summary>
    /// <param name="id">The category identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The category.</returns>
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryResponseDto>> GetById(
        int id,
        CancellationToken cancellationToken = default)
    {
        var category = await _service.GetByIdAsync(id, cancellationToken);

        if (category is null)
        {
            return NotFound();
        }

        return Ok(category);
    }

    /// <summary>
    /// Creates a category.
    /// </summary>
    /// <param name="dto">The category data.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The created category.</returns>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoryResponseDto>> Create(
        CategoryRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var category = await _service.CreateAsync(dto, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    /// <summary>
    /// Updates a category.
    /// </summary>
    /// <param name="id">The category identifier.</param>
    /// <param name="dto">The category data.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>No content.</returns>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        int id,
        CategoryRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        if (!await _service.UpdateAsync(id, dto, cancellationToken))
        {
            return NotFound();
        }

        return NoContent();
    }

    /// <summary>
    /// Deletes a category. Refused (409) while products belong to it.
    /// </summary>
    /// <param name="id">The category identifier.</param>
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
