using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Net.Http.Json;

namespace Tests;

public class ProductSearchTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    /// <summary>
    /// Test to ensure that the GetByIdAsync method returns the correct product when it exists in the repository.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetByIdAsync_ReturnsProduct()
    {
        using var context = CreateContext();
        // NullLogger<T> is appropriate when the test is testing repository behavior, not logging behavior.
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var product = new Product { Name = "Widget", Price = 9.99m, Stock = 5 };
        var created = await repo.CreateAsync(product);

        Assert.True(created.Id > 0);

        var fetched = await repo.GetByIdAsync(created.Id);
        Assert.NotNull(fetched);
        Assert.Equal("Widget", fetched.Name);
        Assert.Equal(9.99m, fetched.Price);
        Assert.Equal(5, fetched.Stock);
    }

    /// <summary>
    /// Test to ensure that the GetByIdAsync method returns null when the product does not exist in the repository.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetByIdAsync_WhenNoProductsExist_ReturnsNull()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var fetched = await repo.GetByIdAsync(99999); // ID that doesn't exist
        Assert.Null(fetched);
    }

    /// <summary>
    /// Test to ensure that the GetByIdAsync method respects cancellation tokens.
    /// Timeouts should only be tested if business critical.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetByIdAsync_WhenCallerCancels_ThrowsOperationCanceledException()
    {
        await using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var product = new Product { Name = "Widget", Price = 9.99m, Stock = 5 };
        var created = await repo.CreateAsync(product);

        // pass an already-canceled token and verify that the method throws OperationCanceledException
        using var cancellationTokenSource = new CancellationTokenSource();
        await cancellationTokenSource.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            repo.GetByIdAsync(
                created.Id,
                cancellationTokenSource.Token));
    }

    /// <summary>
    /// Test to ensure that GetAllAsync returns all products in the repository.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetAllAsync_ReturnsAllProducts()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        var list = (await repo.GetAllAsync()).ToList();
        Assert.Equal(2, list.Count);
    }



    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by name.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnName()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(new ProductSearchQueryDto { Name = "A" }));

        Assert.Equal(3, results.Products.Count);
    }


    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns an empty collection when filtering by name and no products exist in the repository.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_WhenNoProductsExist_ReturnsEmptyCollection()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(new ProductSearchQueryDto { Name = "A" }));

        Assert.Empty(results.Products);
    }

    /// <summary>
    /// Test the page size.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_WhenExceedPageSize_ReturnsPartialList()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                Name = "A",
                PageSize = 3,
            }));

        Assert.Equal(3, results.Products.Count);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by minimum price.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnMinPrice()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                MinPrice = 2m,
            }));

        Assert.Equal(2, results.Products.Count);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns all products when filtering by minimum price and the minimum price is set to 0.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnMinPrice_GetAllProducts()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                MinPrice = 0m,
            }));

        Assert.Equal(5, results.Products.Count);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by maximum price.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnMaxPrice()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                MaxPrice = 1m,
            }));

        Assert.Equal(3, results.Products.Count);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns all products when filtering by maximum price and the maximum price is set to a very high value.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnMaxPrice_GetAllProducts()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                MaxPrice = 9999m,
            }));

        Assert.Equal(5, results.Products.Count);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by low stock only.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnLowStock()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 12 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                LowStockOnly = true,
            }));

        Assert.Equal(4, results.Products.Count);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns all products when filtering by low stock only and the LowStockOnly flag is set to false.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnAllStock()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 12 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                LowStockOnly = false,
            }));

        Assert.Equal(5, results.Products.Count);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by name in ascending order.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnSortByName_ASC()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 10m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "C", Price = 5m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "A", Price = 9m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 12 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                SortBy = "name",
                SortDirection = "asc"
            }));

        Assert.Equal(5, results.Products.Count);

        Assert.Equal("A", results.Products[0].Name);
        Assert.Equal("A", results.Products[1].Name);
        Assert.Equal("B", results.Products[2].Name);
        Assert.Equal("B", results.Products[3].Name);
        Assert.Equal("C", results.Products[4].Name);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by name in descending order.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnSortByName_DESC()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 10m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "C", Price = 5m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "A", Price = 9m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 12 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                SortBy = "name",
                SortDirection = "desc"
            }));

        Assert.Equal(5, results.Products.Count);

        Assert.Equal("C", results.Products[0].Name);
        Assert.Equal("B", results.Products[1].Name);
        Assert.Equal("B", results.Products[2].Name);
        Assert.Equal("A", results.Products[3].Name);
        Assert.Equal("A", results.Products[4].Name);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by price in ascending order.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnSortByPrice_ASC()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 10m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "A", Price = 5m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "B", Price = 9m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 12 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                SortBy = "price",
                SortDirection = "asc"
            }));

        Assert.Equal(5, results.Products.Count);

        Assert.Equal(1m, results.Products[0].Price);
        Assert.Equal(2m, results.Products[1].Price);
        Assert.Equal(5m, results.Products[2].Price);
        Assert.Equal(9m, results.Products[3].Price);
        Assert.Equal(10m, results.Products[4].Price);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by price in descending order.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnSortByPrice_DESC()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 10m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "A", Price = 5m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "B", Price = 9m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 12 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                SortBy = "price",
                SortDirection = "desc"
            }));

        Assert.Equal(5, results.Products.Count);

        Assert.Equal(10m, results.Products[0].Price);
        Assert.Equal(9m, results.Products[1].Price);
        Assert.Equal(5m, results.Products[2].Price);
        Assert.Equal(2m, results.Products[3].Price);
        Assert.Equal(1m, results.Products[4].Price);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by stock in ascending order.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnSortByStock_ASC()
    {
        await using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "A", Price = 10m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "A", Price = 5m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "B", Price = 9m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 12 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                SortBy = "price",
                SortDirection = "asc"
            }));

        Assert.Equal(5, results.Products.Count);

        Assert.Equal(1m, results.Products[0].Price);
        Assert.Equal(2m, results.Products[1].Price);
        Assert.Equal(5m, results.Products[2].Price);
        Assert.Equal(9m, results.Products[3].Price);
        Assert.Equal(10m, results.Products[4].Price);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns the correct products when filtering by stock in descending order.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnSortByStock_DESC()
    {
        await using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 5 });
        await repo.CreateAsync(new Product { Name = "A", Price = 10m, Stock = 8 });
        await repo.CreateAsync(new Product { Name = "A", Price = 5m, Stock = 1 });
        await repo.CreateAsync(new Product { Name = "B", Price = 9m, Stock = 10 });
        await repo.CreateAsync(new Product { Name = "B", Price = 2m, Stock = 2 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                SortBy = "stock",
                SortDirection = "desc"
            }));

        Assert.Equal(5, results.Products.Count);

        Assert.Equal(10, results.Products[0].Stock);
        Assert.Equal(8, results.Products[1].Stock);
        Assert.Equal(5, results.Products[2].Stock);
        Assert.Equal(2, results.Products[3].Stock);
        Assert.Equal(1, results.Products[4].Stock);
    }

    /// <summary>
    /// Test to ensure that GetWithPagerAsync returns only the products of the requested category, with its name.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnCategory()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        var tools = new Category { Name = "Tools" };
        var food = new Category { Name = "Food" };
        context.Categories.AddRange(tools, food);
        await context.SaveChangesAsync();
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 1, CategoryId = tools.Id });
        await repo.CreateAsync(new Product { Name = "B", Price = 1m, Stock = 1, CategoryId = tools.Id });
        await repo.CreateAsync(new Product { Name = "C", Price = 1m, Stock = 1, CategoryId = food.Id });
        await repo.CreateAsync(new Product { Name = "D", Price = 1m, Stock = 1 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                CategoryId = tools.Id,
            }));

        Assert.Equal(2, results.TotalItems);
        Assert.Equal(["A", "B"], results.Products.Select(p => p.Name));
        Assert.All(results.Products, p => Assert.Equal("Tools", p.CategoryName));
    }

    /// <summary>
    /// Test to ensure that the low stock filter uses the threshold of each product instead of a fixed value.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetWithPagerAsync_FilterOnLowStock_UsesProductThreshold()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        await repo.CreateAsync(new Product { Name = "A", Price = 1m, Stock = 3, LowStockThreshold = 2 });
        await repo.CreateAsync(new Product { Name = "B", Price = 1m, Stock = 3, LowStockThreshold = 3 });
        await repo.CreateAsync(new Product { Name = "C", Price = 1m, Stock = 30, LowStockThreshold = 50 });

        ProductListDto results = (await repo.GetWithPagerAsync(
            new ProductSearchQueryDto
            {
                LowStockOnly = true,
            }));

        Assert.Equal(["B", "C"], results.Products.Select(p => p.Name));
        Assert.Equal(["B", "C"], (await repo.GetLowStockAsync()).Select(p => p.Name)); // lowest stock first
    }

    /// <summary>
    /// Test to ensure that the search reads its parameters from the query string
    /// (without [FromQuery], [ApiController] bound the DTO from the body and every GET got 415 Unsupported Media Type).
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Api_GetWithPager_ReadsFiltersFromQueryString()
    {
        using var factory = new InMemoryWebApplicationFactory();
        await factory.SeedAsync(context => context.Products.AddRange(
            new Product { Name = "Hammer", Price = 12m, Stock = 3 },
            new Product { Name = "Nails", Price = 2m, Stock = 300 }));
        var (client, _) = await factory.CreateAuthenticatedClientAsync("User");

        var response = await client.GetAsync("/api/v1/products/paged?name=Ham&pageSize=5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = await response.Content.ReadFromJsonAsync<ProductListDto>();
        Assert.Equal("Hammer", Assert.Single(page!.Products).Name);
    }

}