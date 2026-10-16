using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tests;

public class DashboardTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static DashboardRepository CreateRepository(AppDbContext context, IMemoryCache cache) =>
        new(context, NullLogger<DashboardRepository>.Instance, cache);

    /// <summary>
    /// The API sends enums as strings.
    /// </summary>
    private static readonly JsonSerializerOptions ApiJson = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    // ---------------------------------------------------------------------
    // Repository tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that the dashboard counts the products, values the stock, lists the low stock products
    /// (lowest first, at most 10) and the 10 latest movements (most recent first).
    /// </summary>
    [Fact]
    public async Task GetAsync_ComputesFigures()
    {
        using var context = CreateContext();
        var warehouse = new Warehouse { Name = "Main" };
        context.Warehouses.Add(warehouse);

        // 12 low stock products (stock 0..11, threshold 20) and 1 well stocked product.
        for (var i = 0; i < 12; i++)
        {
            context.Products.Add(new Product { Name = $"Low {i:00}", Price = 1m, Stock = 11 - i, LowStockThreshold = 20 });
        }

        var stocked = new Product { Name = "Stocked", Price = 2.5m, Stock = 100, LowStockThreshold = 10 };
        context.Products.Add(stocked);
        await context.SaveChangesAsync();

        var start = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 12; i++)
        {
            context.StockMovements.Add(new StockMovement
            {
                ProductId = stocked.Id,
                WarehouseId = warehouse.Id,
                UserId = 1,
                Type = StockMovementType.In,
                Quantity = i + 1,
                Date = start.AddHours(i)
            });
        }

        await context.SaveChangesAsync();

        var dashboard = await CreateRepository(context, new MemoryCache(new MemoryCacheOptions())).GetAsync();

        Assert.Equal(13, dashboard.ProductCount);
        Assert.Equal(66m + 250m, dashboard.TotalStockValue); // 0 + 1 + ... + 11 at 1 €, plus 100 at 2.50 €
        Assert.Equal(12, dashboard.LowStockProductCount);
        Assert.Equal(10, dashboard.LowStockProducts.Count);
        Assert.Equal(0, dashboard.LowStockProducts[0].Stock);
        Assert.DoesNotContain(dashboard.LowStockProducts, p => p.Name == "Stocked");
        Assert.Equal(10, dashboard.RecentMovements.Count);
        Assert.Equal(start.AddHours(11), dashboard.RecentMovements[0].Date);
        Assert.Equal("Stocked", dashboard.RecentMovements[0].ProductName);
    }

    /// <summary>
    /// Test to ensure that an empty inventory gives zeros, not an error (SUM over no row).
    /// </summary>
    [Fact]
    public async Task GetAsync_WhenInventoryIsEmpty_ReturnsZeros()
    {
        using var context = CreateContext();

        var dashboard = await CreateRepository(context, new MemoryCache(new MemoryCacheOptions())).GetAsync();

        Assert.Equal(0, dashboard.ProductCount);
        Assert.Equal(0m, dashboard.TotalStockValue);
        Assert.Empty(dashboard.LowStockProducts);
        Assert.Empty(dashboard.RecentMovements);
    }

    /// <summary>
    /// Test to ensure that the dashboard is served from the cache until its key is evicted.
    /// </summary>
    [Fact]
    public async Task GetAsync_IsCachedUntilEvicted()
    {
        using var context = CreateContext();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = CreateRepository(context, cache);

        var first = await repo.GetAsync();

        // A change written without going through the repositories does not evict the cache.
        context.Products.Add(new Product { Name = "New", Price = 1m, Stock = 1 });
        await context.SaveChangesAsync();

        var cached = await repo.GetAsync();
        Assert.Same(first, cached);
        Assert.Equal(0, cached.ProductCount);

        // What ProductRepository and StockMovementRepository do after a write.
        cache.Remove(CacheKeys.Dashboard);

        Assert.Equal(1, (await repo.GetAsync()).ProductCount);
    }

    /// <summary>
    /// Test to ensure that a product write through the repository evicts the dashboard.
    /// </summary>
    [Fact]
    public async Task ProductWrites_EvictDashboard()
    {
        using var context = CreateContext();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var dashboardRepo = CreateRepository(context, cache);
        var productRepo = new ProductRepository(context, NullLogger<ProductRepository>.Instance, cache);

        Assert.Equal(0, (await dashboardRepo.GetAsync()).ProductCount);

        var created = await productRepo.CreateAsync(new Product { Name = "A", Price = 2m, Stock = 1 });
        Assert.Equal(1, (await dashboardRepo.GetAsync()).ProductCount);

        await productRepo.UpdateAsync(created.Id, new Product { Name = "A", Price = 2m, Stock = 5 });
        Assert.Equal(10m, (await dashboardRepo.GetAsync()).TotalStockValue);

        await productRepo.DeleteAsync(created.Id);
        Assert.Equal(0, (await dashboardRepo.GetAsync()).ProductCount);
    }

    /// <summary>
    /// Test to ensure that GetAsync respects cancellation tokens when the dashboard is not cached.
    /// </summary>
    [Fact]
    public async Task GetAsync_WhenCallerCancels_ThrowsOperationCanceledException()
    {
        await using var context = CreateContext();
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            CreateRepository(context, new MemoryCache(new MemoryCacheOptions())).GetAsync(cts.Token));
    }

    // ---------------------------------------------------------------------
    // Integration tests: movement then dashboard
    // ---------------------------------------------------------------------

    /// <summary>
    /// Scenario: the dashboard is read (and cached), a movement is recorded, the dashboard is read again:
    /// it shows the movement and the new figures at once, without waiting for the 60 s of the cache.
    /// A refused movement leaves it unchanged.
    /// </summary>
    [Fact]
    public async Task Api_MovementThenDashboard_ShowsNewFiguresImmediately()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var screws = new Product { Name = "Screws", Price = 2.5m, Stock = 4, LowStockThreshold = 5 };
        var drill = new Product { Name = "Drill", Price = 10m, Stock = 20, LowStockThreshold = 5 };
        var warehouse = new Warehouse { Name = "Main" };
        await factory.SeedAsync(context => context.AddRange(screws, drill, warehouse));
        var (client, _) = await factory.CreateAuthenticatedClientAsync("User");

        var before = await client.GetFromJsonAsync<DashboardDto>("/api/v1/dashboard", ApiJson);
        Assert.Equal(2, before!.ProductCount);
        Assert.Equal(210m, before.TotalStockValue); // 4 × 2.50 + 20 × 10
        Assert.Equal("Screws", Assert.Single(before.LowStockProducts).Name);
        Assert.Empty(before.RecentMovements);

        // Served from the cache: same computation time.
        var cached = await client.GetFromJsonAsync<DashboardDto>("/api/v1/dashboard", ApiJson);
        Assert.Equal(before.GeneratedAtUtc, cached!.GeneratedAtUtc);

        var movement = await client.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId = screws.Id, warehouseId = warehouse.Id, type = "In", quantity = 10 });
        Assert.Equal(HttpStatusCode.Created, movement.StatusCode);

        var after = await client.GetFromJsonAsync<DashboardDto>("/api/v1/dashboard", ApiJson);
        Assert.True(after!.GeneratedAtUtc > before.GeneratedAtUtc);
        Assert.Equal(235m, after.TotalStockValue); // 14 × 2.50 + 20 × 10
        Assert.Equal(0, after.LowStockProductCount);
        var recent = Assert.Single(after.RecentMovements);
        Assert.Equal("Screws", recent.ProductName);
        Assert.Equal(StockMovementType.In, recent.Type);
        Assert.Equal(10, recent.Quantity);

        // A refused movement (stock would become negative) changes nothing.
        var refused = await client.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId = screws.Id, warehouseId = warehouse.Id, type = "Out", quantity = 15 });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);

        var unchanged = await client.GetFromJsonAsync<DashboardDto>("/api/v1/dashboard", ApiJson);
        Assert.Equal(after.GeneratedAtUtc, unchanged!.GeneratedAtUtc);
        Assert.Equal(235m, unchanged.TotalStockValue);
    }

    /// <summary>
    /// Test to ensure that GET /api/v1/products/low-stock lists the products at or below their threshold, lowest stock first.
    /// </summary>
    [Fact]
    public async Task Api_LowStock_ListsProductsAtOrBelowThreshold()
    {
        using var factory = new InMemoryWebApplicationFactory();
        await factory.SeedAsync(context => context.Products.AddRange(
            new Product { Name = "At threshold", Price = 1m, Stock = 5, LowStockThreshold = 5 },
            new Product { Name = "Empty", Price = 1m, Stock = 0, LowStockThreshold = 5 },
            new Product { Name = "Above", Price = 1m, Stock = 6, LowStockThreshold = 5 }));
        var (client, _) = await factory.CreateAuthenticatedClientAsync("User");

        var lowStock = await client.GetFromJsonAsync<List<ProductResponseDto>>("/api/v1/products/low-stock");

        Assert.Equal(["Empty", "At threshold"], lowStock!.Select(p => p.Name));
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync("/api/v1/dashboard")).StatusCode);
    }
}
