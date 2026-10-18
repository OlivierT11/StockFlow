using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Linq.Expressions;
using Inventory.Repositories.Interfaces;

namespace Inventory.Repositories;

/// <summary>
/// Database calls for the products. Every call is canceled after a timeout (10 s by default) or when the caller cancels.
/// </summary>
public class ProductRepository : IProductRepository
{
    private readonly AppDbContext _context;
    private readonly ILogger<ProductRepository> _logger;
    private readonly TimeSpan _timeout;
    private readonly IMemoryCache _cache;


    /// <summary>
    /// Initializes a new instance of the <see cref="ProductRepository"/> class.
    /// </summary>
    /// <param name="context">The database context.</param>
    /// <param name="logger">The logger.</param>
    /// <param name="cache">The cache holding the products read by id (and the dashboard, evicted on writes).</param>
    /// <param name="timeout">The timeout of each database call (10 s by default).</param>
    public ProductRepository(
        AppDbContext context,
        ILogger<ProductRepository> logger,
        IMemoryCache cache,
        TimeSpan? timeout = null)
    {
        _context = context;
        _logger = logger;
        _timeout = timeout ?? TimeSpan.FromSeconds(10);
        _cache = cache;
    }

    /// <inheritdoc />
    public async Task<List<Product>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        // timeout token
        using var timeoutCts = new CancellationTokenSource(_timeout);

        // link the cancellation token with the timeout token
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            return await _context.Products
            .AsNoTracking()
            .Select(ProductProjections.ToModel)
            .ToListAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Get product was canceled by the caller");

            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Get product timed out");

            throw;
        }
    }

    /// <inheritdoc />
    public async Task<ProductListDto> GetWithPagerAsync(
        ProductSearchQueryDto query,
        CancellationToken cancellationToken = default)
    {
        // timeout token
        using var timeoutCts = new CancellationTokenSource(_timeout);

        // link the cancellation token with the timeout token
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            // Compter le nombre total d'éléments dans la table Products
            var result = _context.Products
            .AsNoTracking();

            if (!string.IsNullOrEmpty(query.Name))
            {
                result = result.Where(p => p.Name.Contains(query.Name));
            }

            if (query.MinPrice > 0)
            {
                result = result.Where(p => p.Price >= query.MinPrice);
            }

            if (query.MaxPrice > 0)
            {
                result = result.Where(p => p.Price <= query.MaxPrice);
            }

            if (query.LowStockOnly)
            {
                result = result.Where(p => p.Stock <= p.LowStockThreshold);
            }

            if (query.CategoryId is not null)
            {
                result = result.Where(p => p.CategoryId == query.CategoryId);
            }

            result = query.SortBy switch
            {
                "name" => query.SortDirection == "desc"
                    ? result.OrderByDescending(p => p.Name)
                    : result.OrderBy(p => p.Name),
                "price" => query.SortDirection == "desc"
                    ? result.OrderByDescending(p => p.Price)
                    : result.OrderBy(p => p.Price),
                "stock" => query.SortDirection == "desc"
                    ? result.OrderByDescending(p => p.Stock)
                    : result.OrderBy(p => p.Stock),
                _ => result.OrderBy(p => p.Id) // Default sorting by Id
            };

            var totalItems = await result.CountAsync(linkedCts.Token);
            var totalPages = (int)Math.Ceiling(totalItems / (double)query.PageSize);

            // Récupérer les produits pour la page demandée
            var products = await result
                .Skip((query.AskedPage - 1) * query.PageSize)  // Skip(20) ignore les 20 premiers produits.
                .Take(query.PageSize) // Take(10) récupère au maximum 10 produits.
                .Select(ProductProjections.ToResponseDto)
                .ToListAsync(linkedCts.Token);

            // Construire le DTO de réponse avec les informations de pagination
            var productListDto = new ProductListDto
            {
                Products = products,
                TotalItems = totalItems,
                TotalPages = totalPages
            };

            return productListDto;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Get product was canceled by the caller");

            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Get product timed out");

            throw;
        }
    }

    /// <summary>
    /// Gets a product by its ID with a timeout of 10 seconds. If the operation takes longer than 10 seconds, it will be canceled.
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <param name="cancellationToken">The cancellation token (set as default if the method is called outside a controller).</param>
    /// <returns>The requested product or null if not found.</returns>
    public async Task<Product?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        // timeout token
        using var timeoutCts = new CancellationTokenSource(_timeout);

        // link the cancellation token with the timeout token
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            string cacheKey = CacheKeys.Product(id);

            if (_cache.TryGetValue<Product>(cacheKey, out var cachedProduct))
            {
                Console.WriteLine("Value used from cache.");
                return cachedProduct;
            }

            var product = await _context.Products
                .AsNoTracking()
                .Where(product => product.Id == id)
                .Select(ProductProjections.ToModel)
                .FirstOrDefaultAsync(linkedCts.Token);

            if (product != null)
            {
                _cache.Set(
                    cacheKey,
                    product,
                    TimeSpan.FromMinutes(5));
            }

            Console.WriteLine("Value used from DB.");
            return product;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Get product was canceled by the caller");

            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Get product timed out");

            throw;
        }
    }

    /// <summary>
    /// Creates a new product with a timeout of 10 seconds. If the operation takes longer than 10 seconds, it will be canceled.
    /// </summary>
    /// <param name="product">The product to create.</param>
    /// <param name="cancellationToken">The cancellation token (set as default if the method is called outside a controller).</param>
    /// <returns>The created product.</returns>
    public async Task<Product> CreateAsync(
        Product product,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            _context.Products.Add(product);
            await _context.SaveChangesAsync(linkedCts.Token);

            _cache.Remove(CacheKeys.Dashboard);

            // Loads the category name for the response.
            if (product.CategoryId is not null)
            {
                await _context.Entry(product)
                    .Reference(p => p.Category)
                    .LoadAsync(linkedCts.Token);
            }

            return new Product
            {
                Id = product.Id,
                Name = product.Name,
                Price = product.Price,
                Stock = product.Stock,
                LowStockThreshold = product.LowStockThreshold,
                CategoryId = product.CategoryId,
                Category = product.Category is null
                    ? null
                    : new Category { Id = product.Category.Id, Name = product.Category.Name }
            };
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Create product was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Create product timed out");
            throw;
        }
    }

    /// <summary>
    /// Updates an existing product with a timeout of 10 seconds. If the operation takes longer than 10 seconds, it will be canceled.
    /// </summary>
    /// <param name="id">Id of the product to update.</param>
    /// <param name="product">The product to update.</param>
    /// <param name="cancellationToken">The cancellation token (set as default if the method is called outside a controller).</param>
    /// <returns>A boolean indicating whether the product was updated (false if it does not exist or was deleted by another request).</returns>
    /// <exception cref="DbUpdateConcurrencyException">The product was modified by another request after it was loaded.</exception>
    public async Task<bool> UpdateAsync(
        int id,
        Product product,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            var updatedProduct = await _context.Products
            .FirstOrDefaultAsync(p => p.Id == id, linkedCts.Token);

            if (updatedProduct is null)
            {
                return false;
            }

            // Console.WriteLine(updatedProduct.State); // DEBUG: Log the state of the entity before updating

            updatedProduct.Name = product.Name;
            updatedProduct.Price = product.Price;
            updatedProduct.Stock = product.Stock;
            updatedProduct.LowStockThreshold = product.LowStockThreshold;
            updatedProduct.CategoryId = product.CategoryId;

            // Console.WriteLine(updatedProduct.State); // DEBUG: Log the state of the entity after updating

            try
            {
                await _context.SaveChangesAsync(linkedCts.Token);
            }
            catch (DbUpdateConcurrencyException)
            {
                // Another request deleted or modified the product after it was loaded.
                var entry = _context.Entry(updatedProduct);
                var databaseValues = await entry.GetDatabaseValuesAsync(linkedCts.Token);

                // Detach it so a later SaveChanges on this context does not retry the update.
                entry.State = EntityState.Detached;

                if (databaseValues is null)
                {
                    _logger.LogInformation(
                        "Update product was skipped: the product was deleted by another request");

                    return false;
                }

                _logger.LogInformation(
                    "Update product was rejected: the product was modified by another request");

                throw;
            }

            _cache.Remove(CacheKeys.Product(id));
            _cache.Remove(CacheKeys.Dashboard);

            return true;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Update product was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Update product timed out");
            throw;
        }
    }

    /// <summary>
    /// Deletes a product by its ID with a timeout of 10 seconds. If the operation takes longer than 10 seconds, it will be canceled.
    /// </summary>
    /// <param name="id">The ID of the product to delete.</param>
    /// <param name="cancellationToken">The cancellation token (set as default if the method is called outside a controller).</param>
    /// <returns>A boolean indicating whether the product was deleted (false if it does not exist or was already deleted by another request).</returns>
    /// <exception cref="DbUpdateConcurrencyException">The product was modified by another request after it was loaded.</exception>
    public async Task<bool> DeleteAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            var product = await _context.Products
                .FirstOrDefaultAsync(p => p.Id == id, linkedCts.Token);

            if (product is null)
            {
                return false;
            }

            _context.Products.Remove(product);

            try
            {
                await _context.SaveChangesAsync(linkedCts.Token);
            }
            catch (DbUpdateConcurrencyException)
            {
                // Another request deleted or modified the product after it was loaded.
                var entry = _context.Entry(product);
                var databaseValues = await entry.GetDatabaseValuesAsync(linkedCts.Token);

                // Detach it so a later SaveChanges on this context does not retry the delete.
                entry.State = EntityState.Detached;

                if (databaseValues is null)
                {
                    _logger.LogInformation(
                        "Delete product was skipped: the product was already deleted by another request");

                    return false;
                }

                _logger.LogInformation(
                    "Delete product was rejected: the product was modified by another request");

                throw;
            }

            _cache.Remove(CacheKeys.Product(id));
            _cache.Remove(CacheKeys.Dashboard);

            return true;
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Delete product was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Delete product timed out");
            throw;
        }
    }

    /// <summary>
    /// Gets the products whose stock is at or below their low stock threshold, lowest stock first.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The low stock products.</returns>
    public async Task<List<ProductResponseDto>> GetLowStockAsync(
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            return await _context.Products
                .AsNoTracking()
                .Where(p => p.Stock <= p.LowStockThreshold)
                .OrderBy(p => p.Stock)
                .ThenBy(p => p.Name)
                .Select(ProductProjections.ToResponseDto)
                .ToListAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Get low stock products was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Get low stock products timed out");
            throw;
        }
    }

    /// <summary>
    /// Checks whether the product has stock movements (a product with a history cannot be deleted).
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>True if at least one movement references the product.</returns>
    public async Task<bool> HasMovementsAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        using var timeoutCts = new CancellationTokenSource(_timeout);

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        try
        {
            return await _context.StockMovements
                .AnyAsync(m => m.ProductId == id, linkedCts.Token);
        }
        catch (OperationCanceledException) when (
            cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation(
                "Check product movements was canceled by the caller");
            throw;
        }
        catch (OperationCanceledException) when (
            timeoutCts.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Check product movements timed out");
            throw;
        }
    }
}

/// <summary>
/// Product projections shared by the queries, so that every endpoint returns the same fields.
/// They are expressions, so EF Core translates them to SQL (only the selected columns are read, the category with a LEFT JOIN).
/// </summary>
public static class ProductProjections
{
    /// <summary>
    /// Projects a product to a detached model, with its category id and name only.
    /// </summary>
    public static readonly Expression<Func<Product, Product>> ToModel = product => new Product
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price,
        Stock = product.Stock,
        LowStockThreshold = product.LowStockThreshold,
        CategoryId = product.CategoryId,
        Category = product.Category == null
            ? null
            : new Category { Id = product.Category.Id, Name = product.Category.Name }
    };

    /// <summary>
    /// Projects a product to the DTO returned by the API.
    /// </summary>
    public static readonly Expression<Func<Product, ProductResponseDto>> ToResponseDto = product => new ProductResponseDto
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price,
        Stock = product.Stock,
        LowStockThreshold = product.LowStockThreshold,
        CategoryId = product.CategoryId,
        CategoryName = product.Category == null ? null : product.Category.Name
    };
}
