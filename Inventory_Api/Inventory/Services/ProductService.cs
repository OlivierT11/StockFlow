using Inventory.DTOs;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Inventory.Services;

/// <summary>
/// Product business rules: maps the DTOs to the model and checks the referenced category.
/// </summary>
public class ProductService : IProductService
{
    private readonly IProductRepository _productRepository;
    private readonly ICategoryRepository _categoryRepository;

    /// <summary>
    /// Initializes a new instance of the <see cref="ProductService"/> class.
    /// </summary>
    /// <param name="productRepository">The product repository.</param>
    /// <param name="categoryRepository">The category repository, used to check the category of a product.</param>
    public ProductService(IProductRepository productRepository, ICategoryRepository categoryRepository)
    {
        _productRepository = productRepository;
        _categoryRepository = categoryRepository;
    }

    /// <inheritdoc />
    public async Task<List<ProductResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {

        var products = await _productRepository.GetAllAsync(cancellationToken);
        return products.Select(ToResponseDto).ToList();
    }

    /// <inheritdoc />
    public async Task<ProductListDto> GetWithPagerAsync(ProductSearchQueryDto query, CancellationToken cancellationToken = default)
    {
        return await _productRepository.GetWithPagerAsync(query, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<List<ProductResponseDto>> GetLowStockAsync(CancellationToken cancellationToken = default)
    {
        return await _productRepository.GetLowStockAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ProductResponseDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {

        var product = await _productRepository.GetByIdAsync(id, cancellationToken);
        if (product == null)
        {
            return null;
        }

        return ToResponseDto(product);
    }

    /// <inheritdoc />
    public async Task<ProductResponseDto> CreateAsync(ProductCreateDto dto, CancellationToken cancellationToken = default)
    {
        await EnsureCategoryExistsAsync(dto.CategoryId, cancellationToken);

        var product = new Product
        {
            Name = dto.Name,
            Price = dto.Price,
            Stock = dto.Stock,
            LowStockThreshold = dto.LowStockThreshold,
            CategoryId = dto.CategoryId
        };

        var createdProduct = await _productRepository.CreateAsync(product, cancellationToken);

        return ToResponseDto(createdProduct);
    }

    /// <inheritdoc />
    public async Task<bool> UpdateAsync(int id, ProductUpdateDto dto, CancellationToken cancellationToken = default)
    {
        await EnsureCategoryExistsAsync(dto.CategoryId, cancellationToken);

        var product = new Product
        {
            Id = id,
            Name = dto.Name,
            Price = dto.Price,
            Stock = dto.Stock,
            LowStockThreshold = dto.LowStockThreshold,
            CategoryId = dto.CategoryId
        };

        return await _productRepository.UpdateAsync(id, product, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        // The movements are the stock history: deleting the product would delete them too (and the database refuses it).
        if (await _productRepository.HasMovementsAsync(id, cancellationToken))
        {
            throw new ConflictException(
                $"Le produit {id} a des mouvements de stock : il ne peut pas être supprimé.");
        }

        return await _productRepository.DeleteAsync(id, cancellationToken);
    }

    private async Task EnsureCategoryExistsAsync(int? categoryId, CancellationToken cancellationToken)
    {
        if (categoryId is not null &&
            !await _categoryRepository.ExistsAsync(categoryId.Value, cancellationToken))
        {
            throw new InvalidReferenceException(
                nameof(ProductCreateDto.CategoryId),
                $"La catégorie {categoryId} n'existe pas.");
        }
    }

    private static ProductResponseDto ToResponseDto(Product product) => new()
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price,
        Stock = product.Stock,
        LowStockThreshold = product.LowStockThreshold,
        CategoryId = product.CategoryId,
        CategoryName = product.Category?.Name
    };
}
