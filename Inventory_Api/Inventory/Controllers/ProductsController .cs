using Inventory.DTOs;
using Inventory.Models;
using Inventory.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Controllers;

// Handles HTTP requests. Calls the services.
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _service;

    public ProductsController(IProductService service)
    {
        _service = service;
    }

    /// <summary>
    /// Gets all products.
    /// </summary>
    /// <returns>The list of all products.</returns>
    [HttpGet]
    [Authorize(Roles = "Admin,User")]
    public async Task<ActionResult<List<ProductResponseDto>>> GetAll(
        CancellationToken cancellationToken = default)
    {
        var products = await _service.GetAllAsync(cancellationToken);
        return Ok(products);
    }

    [HttpGet("paged")]
    [Authorize(Roles = "Admin,User")]
    public async Task<ActionResult<ProductListDto>> GetWithPager(
    ProductSearchQueryDto query,
    CancellationToken cancellationToken = default)
    {
        if (query.AskedPage < 1)
            query.AskedPage = 1;

        var productListDto = await _service.GetWithPagerAsync(query, cancellationToken);

        return Ok(productListDto);
    }

    /// <summary>
    /// Gets a product by its ID.
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <returns>The requested product.</returns>
    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,User")]
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
    /// <returns>The created product.</returns>
    [HttpPost]
    [Authorize(Roles = "Admin")]
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
    /// <returns>A valid action result.</returns>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(
        int id,
        ProductUpdateDto dto,
        CancellationToken cancellationToken = default)
    {
        if (id <= 0)
        {
            throw new ArgumentException("A valid product ID is required.");
        }

        var updated = await _service.UpdateAsync(
            id,
            dto,
            cancellationToken);

        if (!updated)
        {
            return NotFound();
        }

        return NoContent();
    }

    /// <summary>
    /// Deletes a product by its ID.
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <returns>A valid action result.</returns>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(
        int id,
        CancellationToken cancellationToken = default)
    {
        if (id <= 0)
        {
            throw new ArgumentException("A valid product ID is required.");
        }

        var deleted = await _service.DeleteAsync(
            id,
            cancellationToken);

        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}