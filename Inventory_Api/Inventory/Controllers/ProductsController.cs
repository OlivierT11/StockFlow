using Inventory.DTOs;
using Inventory.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Controllers;

/// <summary>
/// Products. Read: any authenticated user. Write: Admin.
/// Handles HTTP requests. Calls the services.
/// </summary>
[ApiController]
[Route("api/v1/products")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public class ProductsController : ControllerBase
{
    private readonly IProductService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="ProductsController"/> class.
    /// </summary>
    /// <param name="service">The product service.</param>
    public ProductsController(IProductService service)
    {
        _service = service;
    }

    /// <summary>
    /// Gets all products.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The list of all products.</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,User")]
    public async Task<ActionResult<List<ProductResponseDto>>> GetAll(
        CancellationToken cancellationToken = default)
    {
        var products = await _service.GetAllAsync(cancellationToken);
        return Ok(products);
    }

    /// <summary>
    /// Searches the products: filters (name, price range, low stock, category), sort and page.
    /// </summary>
    /// <param name="query">The filters, sort and page, read from the query string.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The requested page and the paging metadata.</returns>
    [HttpGet("paged")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,User")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductListDto>> GetWithPager(
    [FromQuery] ProductSearchQueryDto query,
    CancellationToken cancellationToken = default)
    {
        if (query.AskedPage < 1)
            query.AskedPage = 1;

        var productListDto = await _service.GetWithPagerAsync(query, cancellationToken);

        return Ok(productListDto);
    }

    /// <summary>
    /// Gets the products whose stock is at or below their low stock threshold, lowest stock first.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The low stock products.</returns>
    [HttpGet("low-stock")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,User")]
    public async Task<ActionResult<List<ProductResponseDto>>> GetLowStock(
        CancellationToken cancellationToken = default)
    {
        return Ok(await _service.GetLowStockAsync(cancellationToken));
    }

    /// <summary>
    /// Gets a product by its ID.
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The requested product.</returns>
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Authorize(Roles = "Admin,User")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponseDto>> GetById(
        int id,
        CancellationToken cancellationToken = default)
    {
        var product = await _service.GetByIdAsync(id, cancellationToken);

        if (product is null)
        {
            return NotFound();
        }

        return Ok(product);
    }

    /// <summary>
    /// Creates a product.
    /// </summary>
    /// <param name="dto">The product data.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The created product.</returns>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductResponseDto>> Create(
        ProductCreateDto dto,
        CancellationToken cancellationToken = default)
    {
        var product = await _service.CreateAsync(dto, cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = product.Id },
            product);
    }

    /// <summary>
    /// Updates a product by its ID.
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <param name="dto">The product data.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>A valid action result.</returns>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        int id,
        ProductUpdateDto dto,
        CancellationToken cancellationToken = default)
    {
        if (id <= 0)
        {
            throw new ArgumentException("A valid product ID is required.");
        }

        bool updated;

        try
        {
            updated = await _service.UpdateAsync(
                id,
                dto,
                cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The product was modified by another request after it was loaded.
            return Conflict();
        }

        if (!updated)
        {
            return NotFound();
        }

        return NoContent();
    }

    /// <summary>
    /// Deletes a product by its ID. Refused (409) once stock movements were recorded for it.
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>A valid action result.</returns>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        int id,
        CancellationToken cancellationToken = default)
    {
        if (id <= 0)
        {
            throw new ArgumentException("A valid product ID is required.");
        }

        bool deleted;

        try
        {
            deleted = await _service.DeleteAsync(
                id,
                cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The product was modified by another request after it was loaded.
            return Conflict();
        }

        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}