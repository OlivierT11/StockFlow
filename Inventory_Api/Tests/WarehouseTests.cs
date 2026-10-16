using Inventory.Controllers;
using Inventory.Data;
using Inventory.DTOs;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net;
using System.Net.Http.Json;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Tests;

public class WarehouseTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static WarehouseRepository CreateRepository(AppDbContext context) =>
        new(context, NullLogger<WarehouseRepository>.Instance);

    // ---------------------------------------------------------------------
    // Repository tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that a created warehouse can be read back, by id and in the list sorted by name.
    /// </summary>
    [Fact]
    public async Task CreateAsync_ThenGet_ReturnsWarehouse()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);

        var paris = await repo.CreateAsync(new Warehouse { Name = "Paris", Address = "1 rue de Rivoli" });
        await repo.CreateAsync(new Warehouse { Name = "Lyon" });

        var fetched = await repo.GetByIdAsync(paris.Id);
        Assert.Equal("Paris", fetched!.Name);
        Assert.Equal("1 rue de Rivoli", fetched.Address);
        Assert.True(await repo.ExistsAsync(paris.Id));
        Assert.Equal(["Lyon", "Paris"], (await repo.GetAllAsync()).Select(w => w.Name));
    }

    /// <summary>
    /// Test to ensure that updating a warehouse changes its name and address, and that an unknown warehouse returns false.
    /// </summary>
    [Fact]
    public async Task UpdateAsync_UpdatesExistingWarehouse_AndReturnsFalseOtherwise()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);
        var created = await repo.CreateAsync(new Warehouse { Name = "Old", Address = "Old address" });

        Assert.True(await repo.UpdateAsync(created.Id, new Warehouse { Name = "New", Address = null }));
        var fetched = await repo.GetByIdAsync(created.Id);
        Assert.Equal("New", fetched!.Name);
        Assert.Null(fetched.Address);

        Assert.False(await repo.UpdateAsync(999, new Warehouse { Name = "X" }));
    }

    /// <summary>
    /// Test to ensure that deleting a warehouse removes it, and that an unknown warehouse returns false.
    /// </summary>
    [Fact]
    public async Task DeleteAsync_RemovesWarehouse_AndReturnsFalseOtherwise()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);
        var created = await repo.CreateAsync(new Warehouse { Name = "ToDelete" });

        Assert.True(await repo.DeleteAsync(created.Id));
        Assert.Null(await repo.GetByIdAsync(created.Id));
        Assert.False(await repo.DeleteAsync(created.Id));
    }

    /// <summary>
    /// Test to ensure that HasMovementsAsync tells whether movements were recorded in the warehouse.
    /// </summary>
    [Fact]
    public async Task HasMovementsAsync_ReturnsTrueOnlyWhenMovementsExist()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);
        var used = await repo.CreateAsync(new Warehouse { Name = "Used" });
        var empty = await repo.CreateAsync(new Warehouse { Name = "Empty" });
        context.StockMovements.Add(new StockMovement
        {
            ProductId = 1,
            WarehouseId = used.Id,
            UserId = 1,
            Type = StockMovementType.In,
            Quantity = 1
        });
        await context.SaveChangesAsync();

        Assert.True(await repo.HasMovementsAsync(used.Id));
        Assert.False(await repo.HasMovementsAsync(empty.Id));
    }

    /// <summary>
    /// Test to ensure that every repository method respects cancellation tokens.
    /// </summary>
    [Fact]
    public async Task Methods_WhenCallerCancels_ThrowOperationCanceledException()
    {
        await using var context = CreateContext();
        var repo = CreateRepository(context);
        var created = await repo.CreateAsync(new Warehouse { Name = "Main" });

        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.GetAllAsync(cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.GetByIdAsync(created.Id, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.ExistsAsync(created.Id, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.CreateAsync(new Warehouse { Name = "X" }, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.UpdateAsync(created.Id, new Warehouse { Name = "X" }, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.DeleteAsync(created.Id, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.HasMovementsAsync(created.Id, cts.Token));
    }

    // ---------------------------------------------------------------------
    // Service and controller tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that a warehouse with movements cannot be deleted (409 in the API), and is not deleted.
    /// </summary>
    [Fact]
    public async Task Service_DeleteAsync_WhenWarehouseHasMovements_ThrowsConflictException()
    {
        var repo = new Mock<IWarehouseRepository>();
        repo.Setup(r => r.HasMovementsAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        await Assert.ThrowsAsync<ConflictException>(() => new WarehouseService(repo.Object).DeleteAsync(1));

        repo.Verify(r => r.DeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// Test to ensure that the controller translates the service results into the right HTTP results.
    /// </summary>
    [Fact]
    public async Task Controller_ReturnsNotFoundForUnknownWarehouse_AndNoContentOnSuccess()
    {
        var dto = new WarehouseRequestDto { Name = "Main" };
        var service = new Mock<IWarehouseService>();
        service.Setup(s => s.UpdateAsync(1, dto, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        service.Setup(s => s.DeleteAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var controller = new WarehousesController(service.Object);

        Assert.IsType<NotFoundResult>((await controller.GetById(999)).Result);
        Assert.IsType<NotFoundResult>(await controller.Update(999, dto));
        Assert.IsType<NotFoundResult>(await controller.Delete(999));
        Assert.IsType<NoContentResult>(await controller.Update(1, dto));
        Assert.IsType<NoContentResult>(await controller.Delete(1));
    }

    // ---------------------------------------------------------------------
    // API tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test the warehouse cycle through the API, including the refused delete once a movement was recorded.
    /// </summary>
    [Fact]
    public async Task Api_WarehouseCycle()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (admin, _) = await factory.CreateAuthenticatedClientAsync();

        var create = await admin.PostAsJsonAsync("/api/v1/warehouses", new { name = "Main", address = "1 rue de Rivoli" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var warehouse = (await create.Content.ReadFromJsonAsync<WarehouseResponseDto>())!;
        Assert.Equal("1 rue de Rivoli", warehouse.Address);

        var empty = await admin.PostAsJsonAsync("/api/v1/warehouses", new { name = "Empty" });
        var emptyId = (await empty.Content.ReadFromJsonAsync<WarehouseResponseDto>())!.Id;

        var product = new Product { Name = "Widget", Price = 1m };
        await factory.SeedAsync(context => context.Products.Add(product));
        var movement = await admin.PostAsJsonAsync("/api/v1/stock/movements",
            new { productId = product.Id, warehouseId = warehouse.Id, type = "In", quantity = 3 });
        Assert.Equal(HttpStatusCode.Created, movement.StatusCode);

        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/v1/warehouses/{warehouse.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/v1/warehouses/{emptyId}")).StatusCode);

        var all = await admin.GetFromJsonAsync<List<WarehouseResponseDto>>("/api/v1/warehouses");
        Assert.Equal("Main", Assert.Single(all!).Name);
    }
}
