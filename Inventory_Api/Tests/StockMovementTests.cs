using Inventory.Controllers;
using Inventory.Data;
using Inventory.DTOs;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Inventory.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Tests;

public class StockMovementTests
{
    // ---------------------------------------------------------------------
    // Repository tests, on SQLite: CreateAsync opens a transaction, which the in-memory provider would ignore.
    // ---------------------------------------------------------------------

    /// <summary>
    /// Creates a user, a warehouse and a product with the given stock, and returns their ids.
    /// </summary>
    private static async Task<(int ProductId, int WarehouseId, int UserId)> SeedAsync(
        SqliteTestDatabase database,
        int stock)
    {
        using var context = database.CreateContext();

        var user = new User { Username = "user", Email = "user@example.com", PasswordHash = "unused" };
        var warehouse = new Warehouse { Name = "Main" };
        var product = new Product { Name = "Widget", Price = 2m, Stock = stock };

        context.AddRange(user, warehouse, product);
        await context.SaveChangesAsync();

        return (product.Id, warehouse.Id, user.Id);
    }

    private static StockMovementRepository CreateRepository(AppDbContext context, IMemoryCache? cache = null)
    {
        return new StockMovementRepository(
            context,
            NullLogger<StockMovementRepository>.Instance,
            cache ?? new MemoryCache(new MemoryCacheOptions()));
    }

    private static StockMovement Movement(
        (int ProductId, int WarehouseId, int UserId) ids,
        StockMovementType type,
        int quantity,
        DateTime? date = null)
    {
        return new StockMovement
        {
            ProductId = ids.ProductId,
            WarehouseId = ids.WarehouseId,
            UserId = ids.UserId,
            Type = type,
            Quantity = quantity,
            Date = date ?? DateTime.UtcNow
        };
    }

    private static async Task<(int Stock, int MovementCount)> ReadStateAsync(SqliteTestDatabase database, int productId)
    {
        using var context = database.CreateContext();

        var stock = await context.Products
            .Where(p => p.Id == productId)
            .Select(p => p.Stock)
            .SingleAsync();

        return (stock, await context.StockMovements.CountAsync());
    }

    /// <summary>
    /// Test to ensure that each movement type changes the stock in the right direction and is saved with the stock change.
    /// </summary>
    [Theory]
    [InlineData(StockMovementType.In, 4, 14)]
    [InlineData(StockMovementType.Out, 4, 6)]
    [InlineData(StockMovementType.Adjustment, -3, 7)]
    [InlineData(StockMovementType.Adjustment, 2, 12)]
    [InlineData(StockMovementType.Out, 10, 0)] // the whole stock can go out
    public async Task CreateAsync_AppliesMovementToStock(StockMovementType type, int quantity, int expectedStock)
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 10);

        using var context = database.CreateContext();
        var result = await CreateRepository(context).CreateAsync(Movement(ids, type, quantity));

        Assert.Equal(StockMovementOutcome.Created, result.Outcome);
        Assert.NotNull(result.Movement);
        Assert.True(result.Movement.Id > 0);
        Assert.Equal("Widget", result.Movement.ProductName);
        Assert.Equal("Main", result.Movement.WarehouseName);
        Assert.Equal(expectedStock - 10, result.Movement.Delta);

        Assert.Equal((expectedStock, 1), await ReadStateAsync(database, ids.ProductId));
    }

    /// <summary>
    /// Test to ensure that a movement that would make the stock negative is refused and leaves nothing behind.
    /// </summary>
    [Theory]
    [InlineData(StockMovementType.Out, 4)]
    [InlineData(StockMovementType.Adjustment, -4)]
    public async Task CreateAsync_WhenStockWouldBecomeNegative_ReturnsInsufficientStockAndSavesNothing(
        StockMovementType type,
        int quantity)
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 3);

        using var context = database.CreateContext();
        var result = await CreateRepository(context).CreateAsync(Movement(ids, type, quantity));

        Assert.Equal(StockMovementOutcome.InsufficientStock, result.Outcome);
        Assert.Null(result.Movement);
        Assert.Equal((3, 0), await ReadStateAsync(database, ids.ProductId));
    }

    /// <summary>
    /// Test to ensure that a movement on an unknown product or warehouse is refused.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WhenProductOrWarehouseDoesNotExist_ReturnsNotFoundOutcome()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 3);

        using var context = database.CreateContext();
        var repo = CreateRepository(context);

        var unknownProduct = await repo.CreateAsync(Movement(ids with { ProductId = 999 }, StockMovementType.In, 1));
        var unknownWarehouse = await repo.CreateAsync(Movement(ids with { WarehouseId = 999 }, StockMovementType.In, 1));

        Assert.Equal(StockMovementOutcome.ProductNotFound, unknownProduct.Outcome);
        Assert.Equal(StockMovementOutcome.WarehouseNotFound, unknownWarehouse.Outcome);
        Assert.Equal((3, 0), await ReadStateAsync(database, ids.ProductId));
    }

    /// <summary>
    /// Throws a DbUpdateException when the intercepted context is about to save a change matching the predicate,
    /// to simulate a failure of the database at this step.
    /// </summary>
    private sealed class FailingSaveInterceptor(Func<DbContext, bool> failWhen) : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (failWhen(eventData.Context!))
            {
                throw new DbUpdateException("Simulated database failure.");
            }

            return ValueTask.FromResult(result);
        }
    }

    private static bool IsInsertingMovement(DbContext context) =>
        context.ChangeTracker.Entries<StockMovement>().Any(e => e.State == EntityState.Added);

    private static bool IsUpdatingProduct(DbContext context) =>
        context.ChangeTracker.Entries<Product>().Any(e => e.State == EntityState.Modified);

    /// <summary>
    /// Test to ensure that when the insertion of the movement fails, the stock is not changed.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WhenMovementInsertFails_RollsBackAndKeepsStock()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 10);

        using var context = database.CreateContext(new FailingSaveInterceptor(IsInsertingMovement));

        await Assert.ThrowsAsync<DbUpdateException>(() =>
            CreateRepository(context).CreateAsync(Movement(ids, StockMovementType.Out, 4)));

        Assert.Equal((10, 0), await ReadStateAsync(database, ids.ProductId));
    }

    /// <summary>
    /// Test to ensure that when the stock update fails after the movement was inserted,
    /// the transaction rolls back the insertion: no movement without its stock change.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WhenStockUpdateFails_RollsBackMovementInsert()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 10);

        using var context = database.CreateContext(new FailingSaveInterceptor(IsUpdatingProduct));

        await Assert.ThrowsAsync<DbUpdateException>(() =>
            CreateRepository(context).CreateAsync(Movement(ids, StockMovementType.Out, 4)));

        Assert.Equal((10, 0), await ReadStateAsync(database, ids.ProductId));
    }

    /// <summary>
    /// Changes the product row in the database just before the intercepted context updates it,
    /// as if another request had committed a movement between our read and our write.
    /// The change is made on the same connection and transaction (SQLite has a single writer), so it is rolled back too.
    /// </summary>
    private sealed class ConcurrentProductChangeInterceptor(int productId) : SaveChangesInterceptor
    {
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (IsUpdatingProduct(eventData.Context!))
            {
                await eventData.Context!.Database.ExecuteSqlAsync(
                    $"UPDATE Products SET Stock = Stock + 100, Version = randomblob(16) WHERE Id = {productId}",
                    cancellationToken);
            }

            return result;
        }
    }

    /// <summary>
    /// Test to ensure that a product modified by another request between the read and the update is detected
    /// (Product.Version), that the exception reaches the caller (409 in the API) and that the movement is rolled back.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WhenProductModifiedConcurrently_ThrowsDbUpdateConcurrencyExceptionAndRollsBack()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 10);

        using var context = database.CreateContext(new ConcurrentProductChangeInterceptor(ids.ProductId));

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() =>
            CreateRepository(context).CreateAsync(Movement(ids, StockMovementType.Out, 4)));

        Assert.Equal((10, 0), await ReadStateAsync(database, ids.ProductId));

        // The rejected movement must not stay tracked, otherwise the next SaveChanges on this context would retry it.
        Assert.Empty(context.ChangeTracker.Entries());
    }

    /// <summary>
    /// Test to ensure that CreateAsync respects cancellation tokens.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WhenCallerCancels_ThrowsOperationCanceledException()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 10);

        await using var context = database.CreateContext();
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            CreateRepository(context).CreateAsync(Movement(ids, StockMovementType.In, 1), cts.Token));

        Assert.Equal((10, 0), await ReadStateAsync(database, ids.ProductId));
    }

    /// <summary>
    /// Test to ensure that CreateAsync gives up when its timeout expires, logs it as a timeout, and saves nothing.
    /// </summary>
    [Fact]
    public async Task CreateAsync_WhenTimeoutExpires_ThrowsLogsTimeoutAndSavesNothing()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 10);

        await using var context = database.CreateContext();
        var logger = new ListLogger<StockMovementRepository>();
        var repo = new StockMovementRepository(context, logger, new MemoryCache(new MemoryCacheOptions()), TimeoutAssert.Expired);

        await TimeoutAssert.ThrowsAndLogsTimeoutAsync(logger, () =>
            repo.CreateAsync(Movement(ids, StockMovementType.In, 1)));

        Assert.Equal((10, 0), await ReadStateAsync(database, ids.ProductId));
    }

    /// <summary>
    /// Test to ensure that a movement evicts the cached product and dashboard, so they do not show the old stock.
    /// </summary>
    [Fact]
    public async Task CreateAsync_EvictsCachedProductAndDashboard()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 10);
        var cache = new MemoryCache(new MemoryCacheOptions());

        using var context = database.CreateContext();
        var productRepo = new ProductRepository(context, NullLogger<ProductRepository>.Instance, cache);

        Assert.Equal(10, (await productRepo.GetByIdAsync(ids.ProductId))!.Stock); // puts the product in the cache
        cache.Set(CacheKeys.Dashboard, new DashboardDto());

        await CreateRepository(context, cache).CreateAsync(Movement(ids, StockMovementType.Out, 4));

        Assert.False(cache.TryGetValue(CacheKeys.Dashboard, out _));
        Assert.Equal(6, (await productRepo.GetByIdAsync(ids.ProductId))!.Stock);
    }

    /// <summary>
    /// Test to ensure that the movement list is sorted from the most recent, paginated, and filtered by product,
    /// warehouse and period (From inclusive, To exclusive).
    /// </summary>
    [Fact]
    public async Task GetPagedAsync_FiltersSortsAndPaginates()
    {
        using var database = new SqliteTestDatabase();
        var ids = await SeedAsync(database, stock: 0);

        int otherProductId, otherWarehouseId;
        using (var setup = database.CreateContext())
        {
            var otherProduct = new Product { Name = "Other", Price = 1m };
            var otherWarehouse = new Warehouse { Name = "Second" };
            setup.AddRange(otherProduct, otherWarehouse);
            await setup.SaveChangesAsync();
            (otherProductId, otherWarehouseId) = (otherProduct.Id, otherWarehouse.Id);
        }

        var day = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        using (var context = database.CreateContext())
        {
            var repo = CreateRepository(context);
            for (var i = 0; i < 5; i++)
            {
                // Widget in Main on Oct 1st .. 5th
                await repo.CreateAsync(Movement(ids, StockMovementType.In, i + 1, day.AddDays(i)));
            }

            await repo.CreateAsync(Movement(ids with { WarehouseId = otherWarehouseId }, StockMovementType.In, 1, day.AddDays(2)));
            await repo.CreateAsync(Movement(ids with { ProductId = otherProductId }, StockMovementType.In, 1, day.AddDays(2)));
        }

        using var readContext = database.CreateContext();
        var reader = CreateRepository(readContext);

        var all = await reader.GetPagedAsync(new StockMovementQueryDto { PageSize = 3 });
        Assert.Equal(7, all.TotalItems);
        Assert.Equal(3, all.TotalPages);
        Assert.Equal(3, all.Movements.Count);
        Assert.Equal(day.AddDays(4), all.Movements[0].Date); // most recent first
        Assert.Equal(DateTimeKind.Utc, all.Movements[0].Date.Kind); // serialized with a trailing Z

        var lastPage = await reader.GetPagedAsync(new StockMovementQueryDto { PageSize = 3, AskedPage = 3 });
        Assert.Single(lastPage.Movements);
        Assert.Equal(day, lastPage.Movements[0].Date);

        var byProduct = await reader.GetPagedAsync(new StockMovementQueryDto(), ids.ProductId);
        Assert.Equal(6, byProduct.TotalItems);
        Assert.All(byProduct.Movements, m => Assert.Equal("Widget", m.ProductName));

        var byWarehouse = await reader.GetPagedAsync(new StockMovementQueryDto { WarehouseId = otherWarehouseId });
        Assert.Equal("Second", Assert.Single(byWarehouse.Movements).WarehouseName);

        var period = await reader.GetPagedAsync(
            new StockMovementQueryDto { From = day.AddDays(1), To = day.AddDays(3) },
            ids.ProductId);
        Assert.Equal(
            [day.AddDays(2), day.AddDays(2), day.AddDays(1)],
            period.Movements.Select(m => m.Date));
    }

    /// <summary>
    /// Test to ensure that GetPagedAsync respects cancellation tokens.
    /// </summary>
    [Fact]
    public async Task GetPagedAsync_WhenCallerCancels_ThrowsOperationCanceledException()
    {
        using var database = new SqliteTestDatabase();
        await using var context = database.CreateContext();
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            CreateRepository(context).GetPagedAsync(new StockMovementQueryDto(), cancellationToken: cts.Token));
    }

    /// <summary>
    /// Test to ensure that GetPagedAsync gives up when its timeout expires, and logs it as a timeout.
    /// </summary>
    [Fact]
    public async Task GetPagedAsync_WhenTimeoutExpires_ThrowsAndLogsTimeout()
    {
        using var database = new SqliteTestDatabase();
        await using var context = database.CreateContext();
        var logger = new ListLogger<StockMovementRepository>();
        var repo = new StockMovementRepository(context, logger, new MemoryCache(new MemoryCacheOptions()), TimeoutAssert.Expired);

        await TimeoutAssert.ThrowsAndLogsTimeoutAsync(logger, () =>
            repo.GetPagedAsync(new StockMovementQueryDto(), productId: null));
    }

    // ---------------------------------------------------------------------
    // DTO validation
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that the quantity rule depends on the type: In and Out need a positive quantity,
    /// an Adjustment needs a non-zero signed quantity.
    /// </summary>
    [Theory]
    [InlineData(StockMovementType.In, 5, true)]
    [InlineData(StockMovementType.In, 0, false)]
    [InlineData(StockMovementType.Out, 4, true)]
    [InlineData(StockMovementType.Out, -1, false)]
    [InlineData(StockMovementType.Adjustment, -3, true)]
    [InlineData(StockMovementType.Adjustment, 2, true)]
    [InlineData(StockMovementType.Adjustment, 0, false)]
    public void CreateDto_ValidatesQuantityAccordingToType(StockMovementType type, int quantity, bool expectedValid)
    {
        var dto = new StockMovementCreateDto { ProductId = 1, WarehouseId = 1, Type = type, Quantity = quantity };
        var errors = new List<ValidationResult>();

        var valid = Validator.TryValidateObject(
            dto,
            new ValidationContext(dto),
            errors,
            validateAllProperties: true);

        Assert.Equal(expectedValid, valid);
        if (!expectedValid)
        {
            Assert.Equal(nameof(StockMovementCreateDto.Quantity), Assert.Single(Assert.Single(errors).MemberNames));
        }
    }

    // ---------------------------------------------------------------------
    // Service tests (repository mocked)
    // ---------------------------------------------------------------------

    private static StockMovementService CreateService(
        StockMovementCreateResult result,
        Action<StockMovement>? captureMovement = null)
    {
        var movementRepo = new Mock<IStockMovementRepository>();
        movementRepo
            .Setup(r => r.CreateAsync(It.IsAny<StockMovement>(), It.IsAny<CancellationToken>()))
            .Callback<StockMovement, CancellationToken>((m, _) => captureMovement?.Invoke(m))
            .ReturnsAsync(result);

        return new StockMovementService(movementRepo.Object, Mock.Of<IProductRepository>());
    }

    private static StockMovementCreateDto OutOfFour() => new()
    {
        ProductId = 1,
        WarehouseId = 2,
        Type = StockMovementType.Out,
        Quantity = 4
    };

    /// <summary>
    /// Test to ensure that the service records the movement for the authenticated user, at the current date.
    /// </summary>
    [Fact]
    public async Task Service_CreateAsync_SetsUserAndDate()
    {
        StockMovement? saved = null;
        var created = new StockMovementResponseDto { Id = 5 };
        var service = CreateService(new StockMovementCreateResult(StockMovementOutcome.Created, created), m => saved = m);

        var before = DateTime.UtcNow;
        var result = await service.CreateAsync(OutOfFour(), userId: 42);

        Assert.Same(created, result);
        Assert.NotNull(saved);
        Assert.Equal(42, saved.UserId);
        Assert.Equal(StockMovementType.Out, saved.Type);
        Assert.Equal(-4, saved.Delta);
        Assert.InRange(saved.Date, before, DateTime.UtcNow);
    }

    /// <summary>
    /// Test to ensure that the repository outcomes are turned into the exceptions the API maps to 400 and 422.
    /// </summary>
    [Fact]
    public async Task Service_CreateAsync_TurnsOutcomesIntoBusinessExceptions()
    {
        var productNotFound = await Assert.ThrowsAsync<InvalidReferenceException>(() =>
            CreateService(new(StockMovementOutcome.ProductNotFound)).CreateAsync(OutOfFour(), 1));
        Assert.Equal("ProductId", productNotFound.Field);

        var warehouseNotFound = await Assert.ThrowsAsync<InvalidReferenceException>(() =>
            CreateService(new(StockMovementOutcome.WarehouseNotFound)).CreateAsync(OutOfFour(), 1));
        Assert.Equal("WarehouseId", warehouseNotFound.Field);

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateService(new(StockMovementOutcome.InsufficientStock)).CreateAsync(OutOfFour(), 1));
    }

    /// <summary>
    /// Test to ensure that the period is converted to UTC before querying: model binding turns "...Z" dates into local times.
    /// </summary>
    [Fact]
    public async Task Service_GetAsync_ConvertsPeriodToUtc()
    {
        StockMovementQueryDto? sent = null;
        var movementRepo = new Mock<IStockMovementRepository>();
        movementRepo
            .Setup(r => r.GetPagedAsync(It.IsAny<StockMovementQueryDto>(), null, It.IsAny<CancellationToken>()))
            .Callback<StockMovementQueryDto, int?, CancellationToken>((q, _, _) => sent = q)
            .ReturnsAsync(new StockMovementListDto());

        var service = new StockMovementService(movementRepo.Object, Mock.Of<IProductRepository>());
        var utcFrom = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

        await service.GetAsync(new StockMovementQueryDto
        {
            From = utcFrom.ToLocalTime(),
            To = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc) // unspecified: taken as UTC
        });

        Assert.Equal(utcFrom, sent!.From);
        Assert.Equal(DateTimeKind.Utc, sent.From!.Value.Kind);
        Assert.Equal(new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc), sent.To);
        Assert.Equal(DateTimeKind.Utc, sent.To!.Value.Kind);
    }

    /// <summary>
    /// Test to ensure that the movements of an unknown product are not found (404) instead of an empty list.
    /// </summary>
    [Fact]
    public async Task Service_GetByProductAsync_WhenProductDoesNotExist_ReturnsNull()
    {
        var service = new StockMovementService(Mock.Of<IStockMovementRepository>(), Mock.Of<IProductRepository>());

        Assert.Null(await service.GetByProductAsync(999, new StockMovementQueryDto()));
    }

    // ---------------------------------------------------------------------
    // Controller tests (service mocked)
    // ---------------------------------------------------------------------

    private static StockMovementsController CreateController(IStockMovementService service, params Claim[] claims)
    {
        return new StockMovementsController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"))
                }
            }
        };
    }

    /// <summary>
    /// Test to ensure that the Create endpoint records the movement for the user of the token and returns 201.
    /// </summary>
    [Fact]
    public async Task Create_ReturnsCreated_WithMovementOfAuthenticatedUser()
    {
        var dto = OutOfFour();
        var created = new StockMovementResponseDto { Id = 5, UserId = 42 };
        var service = new Mock<IStockMovementService>();
        service.Setup(s => s.CreateAsync(dto, 42, It.IsAny<CancellationToken>())).ReturnsAsync(created);

        var controller = CreateController(service.Object, new Claim(ClaimTypes.NameIdentifier, "42"));

        var result = await controller.Create(dto);

        var objectResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, objectResult.StatusCode);
        Assert.Same(created, objectResult.Value);
    }

    /// <summary>
    /// Test to ensure that a token without user id cannot record a movement (the movement must name its author).
    /// </summary>
    [Fact]
    public async Task Create_ReturnsUnauthorized_WhenTokenHasNoUserId()
    {
        var service = new Mock<IStockMovementService>();
        var controller = CreateController(service.Object);

        var result = await controller.Create(OutOfFour());

        Assert.IsType<UnauthorizedResult>(result.Result);
        service.VerifyNoOtherCalls();
    }

    /// <summary>
    /// Test to ensure that the movements of an unknown product return 404.
    /// </summary>
    [Fact]
    public async Task GetByProduct_ReturnsNotFound_WhenProductDoesNotExist()
    {
        var controller = CreateController(Mock.Of<IStockMovementService>());

        var result = await controller.GetByProduct(999, new StockMovementQueryDto());

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---------------------------------------------------------------------
    // API tests (whole application, in-memory database)
    // ---------------------------------------------------------------------

    /// <summary>
    /// The API sends enums as strings.
    /// </summary>
    private static readonly JsonSerializerOptions ApiJson = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static async Task<(int ProductId, int WarehouseId)> SeedProductAndWarehouseAsync(
        InMemoryWebApplicationFactory factory,
        int stock)
    {
        var product = new Product { Name = "Widget", Price = 2m, Stock = stock };
        var warehouse = new Warehouse { Name = "Main" };
        await factory.SeedAsync(context => context.AddRange(product, warehouse));
        return (product.Id, warehouse.Id);
    }

    /// <summary>
    /// Test to ensure that a user (not only an admin) can record a movement and read it back in the product history.
    /// </summary>
    [Fact]
    public async Task Api_PostMovement_AsUser_ReturnsCreatedAndUpdatesStock()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (productId, warehouseId) = await SeedProductAndWarehouseAsync(factory, stock: 10);
        var (client, userId) = await factory.CreateAuthenticatedClientAsync("User");

        var response = await client.PostAsJsonAsync("/api/v1/stock/movements", new
        {
            productId,
            warehouseId,
            type = "Out",
            quantity = 4,
            notes = "BL-1234"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var movement = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Out", movement.GetProperty("type").GetString());
        Assert.Equal(-4, movement.GetProperty("delta").GetInt32());
        Assert.Equal(userId, movement.GetProperty("userId").GetInt32());
        Assert.EndsWith("Z", movement.GetProperty("date").GetString());

        var product = await client.GetFromJsonAsync<ProductResponseDto>($"/api/v1/products/{productId}");
        Assert.Equal(6, product!.Stock);

        var history = await client.GetFromJsonAsync<StockMovementListDto>($"/api/v1/products/{productId}/movements", ApiJson);
        Assert.Equal("BL-1234", Assert.Single(history!.Movements).Notes);
    }

    /// <summary>
    /// Test to ensure that the business errors of a movement are returned as ProblemDetails with distinct status codes.
    /// </summary>
    [Fact]
    public async Task Api_PostMovement_ReturnsProblemDetailsForEachKindOfError()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (productId, warehouseId) = await SeedProductAndWarehouseAsync(factory, stock: 3);
        var (client, _) = await factory.CreateAuthenticatedClientAsync();

        // 400: model validation (an Out quantity must be positive)
        var invalid = await client.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId, warehouseId, type = "Out", quantity = -1 });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.True((await invalid.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("errors").TryGetProperty("Quantity", out _));

        // 400: unknown product, reported on the field like a validation error
        var unknown = await client.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId = 999, warehouseId, type = "In", quantity = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.True((await unknown.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("errors").TryGetProperty("ProductId", out _));

        // 422: the stock would become negative
        var insufficient = await client.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId, warehouseId, type = "Out", quantity = 4 });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, insufficient.StatusCode);
        var problem = await insufficient.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(422, problem!.Status);
        Assert.Contains("Stock insuffisant", problem.Detail);

        var product = await client.GetFromJsonAsync<ProductResponseDto>($"/api/v1/products/{productId}");
        Assert.Equal(3, product!.Stock);
    }

    /// <summary>
    /// Test to ensure that a concurrency conflict (DbUpdateConcurrencyException) is returned as 409 ProblemDetails.
    /// </summary>
    [Fact]
    public async Task Api_PostMovement_ReturnsConflict_WhenProductModifiedConcurrently()
    {
        var service = new Mock<IStockMovementService>();
        service
            .Setup(s => s.CreateAsync(It.IsAny<StockMovementCreateDto>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException());

        using var baseFactory = new InMemoryWebApplicationFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddScoped(_ => service.Object)));
        var (client, _) = await factory.CreateAuthenticatedClientAsync();

        var response = await client.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId = 1, warehouseId = 1, type = "In", quantity = 1 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(409, problem!.Status);
    }

    /// <summary>
    /// Test to ensure that movements require a token, and that an invalid period is rejected.
    /// </summary>
    [Fact]
    public async Task Api_Movements_RequireTokenAndValidPeriod()
    {
        using var factory = new InMemoryWebApplicationFactory();

        var anonymous = await factory.CreateClient().GetAsync("/api/v1/stock/movements");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

        var (client, _) = await factory.CreateAuthenticatedClientAsync();
        var reversed = await client.GetAsync("/api/v1/stock/movements?from=2026-10-10&to=2026-10-01");
        Assert.Equal(HttpStatusCode.BadRequest, reversed.StatusCode);

        var unknownProduct = await client.GetAsync("/api/v1/products/999/movements");
        Assert.Equal(HttpStatusCode.NotFound, unknownProduct.StatusCode);
    }

    /// <summary>
    /// Test to ensure that GET /api/v1/stock/movements reads the warehouse and the period from the query string,
    /// with "from" inclusive and "to" exclusive. A date without time zone is taken as UTC, a date in UTC ("Z") stays UTC
    /// (model binding turns it into a local time, which the service converts back).
    /// </summary>
    [Fact]
    public async Task Api_GetMovements_FiltersByWarehouseAndPeriod()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (client, userId) = await factory.CreateAuthenticatedClientAsync("User");
        var product = new Product { Name = "Widget", Price = 2m, Stock = 100 };
        var main = new Warehouse { Name = "Main" };
        var other = new Warehouse { Name = "Other" };
        await factory.SeedAsync(context => context.AddRange(product, main, other));

        StockMovement At(Warehouse warehouse, string date, int quantity) => new()
        {
            ProductId = product.Id,
            WarehouseId = warehouse.Id,
            UserId = userId,
            Type = StockMovementType.In,
            Quantity = quantity,
            Date = DateTime.Parse(date, null, System.Globalization.DateTimeStyles.AdjustToUniversal)
        };

        await factory.SeedAsync(context => context.StockMovements.AddRange(
            At(main, "2026-09-30T23:59:59Z", 1),  // before the period
            At(main, "2026-10-01T00:00:00Z", 2),  // first instant of the period: included
            At(main, "2026-10-01T23:59:59Z", 3),  // included
            At(main, "2026-10-02T00:00:00Z", 4),  // "to" is exclusive
            At(other, "2026-10-01T12:00:00Z", 5))); // other warehouse

        var page = await client.GetFromJsonAsync<StockMovementListDto>(
            $"/api/v1/stock/movements?warehouseId={main.Id}&from=2026-10-01&to=2026-10-02T00:00:00Z", ApiJson);

        Assert.Equal(2, page!.TotalItems);
        Assert.Equal([3, 2], page.Movements.Select(m => m.Quantity)); // most recent first
        Assert.All(page.Movements, m => Assert.Equal("Main", m.WarehouseName));
    }

    /// <summary>
    /// Test to ensure that a product with a stock history cannot be deleted (409), so the history is kept.
    /// </summary>
    [Fact]
    public async Task Api_DeleteProduct_ReturnsConflict_WhenProductHasMovements()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (productId, warehouseId) = await SeedProductAndWarehouseAsync(factory, stock: 0);
        var (client, _) = await factory.CreateAuthenticatedClientAsync();

        var movement = await client.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId, warehouseId, type = "In", quantity = 5 });
        Assert.Equal(HttpStatusCode.Created, movement.StatusCode);

        var delete = await client.DeleteAsync($"/api/v1/products/{productId}");

        Assert.Equal(HttpStatusCode.Conflict, delete.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/products/{productId}")).StatusCode);
    }
}
