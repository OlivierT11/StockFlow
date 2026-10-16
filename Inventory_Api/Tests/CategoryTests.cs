using Inventory.Controllers;
using Inventory.Data;
using Inventory.DTOs;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Tests;

public class CategoryTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static CategoryRepository CreateRepository(AppDbContext context) =>
        new(context, NullLogger<CategoryRepository>.Instance);

    // ---------------------------------------------------------------------
    // Repository tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that a created category can be read back, by id and in the list sorted by name.
    /// </summary>
    [Fact]
    public async Task CreateAsync_ThenGet_ReturnsCategory()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);

        var tools = await repo.CreateAsync(new Category { Name = "Tools" });
        await repo.CreateAsync(new Category { Name = "Electronics" });

        Assert.True(tools.Id > 0);
        Assert.Equal("Tools", (await repo.GetByIdAsync(tools.Id))!.Name);
        Assert.True(await repo.ExistsAsync(tools.Id));
        Assert.Equal(["Electronics", "Tools"], (await repo.GetAllAsync()).Select(c => c.Name));
    }

    /// <summary>
    /// Test to ensure that reading an unknown category returns null / false.
    /// </summary>
    [Fact]
    public async Task GetByIdAsync_WhenCategoryDoesNotExist_ReturnsNull()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);

        Assert.Null(await repo.GetByIdAsync(999));
        Assert.False(await repo.ExistsAsync(999));
    }

    /// <summary>
    /// Test to ensure that updating a category changes its name, and that an unknown category returns false.
    /// </summary>
    [Fact]
    public async Task UpdateAsync_UpdatesExistingCategory_AndReturnsFalseOtherwise()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);
        var created = await repo.CreateAsync(new Category { Name = "Old" });

        Assert.True(await repo.UpdateAsync(created.Id, new Category { Name = "New" }));
        Assert.Equal("New", (await repo.GetByIdAsync(created.Id))!.Name);

        Assert.False(await repo.UpdateAsync(999, new Category { Name = "X" }));
    }

    /// <summary>
    /// Test to ensure that deleting a category removes it, and that an unknown category returns false.
    /// </summary>
    [Fact]
    public async Task DeleteAsync_RemovesCategory_AndReturnsFalseOtherwise()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);
        var created = await repo.CreateAsync(new Category { Name = "ToDelete" });

        Assert.True(await repo.DeleteAsync(created.Id));
        Assert.Null(await repo.GetByIdAsync(created.Id));
        Assert.False(await repo.DeleteAsync(created.Id));
    }

    /// <summary>
    /// Test to ensure that HasProductsAsync tells whether products belong to the category.
    /// </summary>
    [Fact]
    public async Task HasProductsAsync_ReturnsTrueOnlyWhenProductsBelongToCategory()
    {
        using var context = CreateContext();
        var repo = CreateRepository(context);
        var used = await repo.CreateAsync(new Category { Name = "Used" });
        var empty = await repo.CreateAsync(new Category { Name = "Empty" });
        context.Products.Add(new Product { Name = "Widget", Price = 1m, Stock = 1, CategoryId = used.Id });
        await context.SaveChangesAsync();

        Assert.True(await repo.HasProductsAsync(used.Id));
        Assert.False(await repo.HasProductsAsync(empty.Id));
    }

    /// <summary>
    /// Test to ensure that every repository method respects cancellation tokens.
    /// </summary>
    [Fact]
    public async Task Methods_WhenCallerCancels_ThrowOperationCanceledException()
    {
        await using var context = CreateContext();
        var repo = CreateRepository(context);
        var created = await repo.CreateAsync(new Category { Name = "Tools" });

        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.GetAllAsync(cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.GetByIdAsync(created.Id, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.ExistsAsync(created.Id, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.CreateAsync(new Category { Name = "X" }, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.UpdateAsync(created.Id, new Category { Name = "X" }, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.DeleteAsync(created.Id, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.HasProductsAsync(created.Id, cts.Token));
    }

    // ---------------------------------------------------------------------
    // Service tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that a category with products cannot be deleted (409 in the API), and is not deleted.
    /// </summary>
    [Fact]
    public async Task Service_DeleteAsync_WhenCategoryHasProducts_ThrowsConflictException()
    {
        var repo = new Mock<ICategoryRepository>();
        repo.Setup(r => r.HasProductsAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        await Assert.ThrowsAsync<ConflictException>(() => new CategoryService(repo.Object).DeleteAsync(1));

        repo.Verify(r => r.DeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// Test to ensure that a product cannot be created or updated with an unknown category (400 in the API).
    /// </summary>
    [Fact]
    public async Task ProductService_WhenCategoryDoesNotExist_ThrowsInvalidReferenceException()
    {
        var productRepo = new Mock<IProductRepository>();
        var service = new ProductService(productRepo.Object, Mock.Of<ICategoryRepository>());

        var onCreate = await Assert.ThrowsAsync<InvalidReferenceException>(() =>
            service.CreateAsync(new ProductCreateDto { Name = "Widget", CategoryId = 999 }));
        await Assert.ThrowsAsync<InvalidReferenceException>(() =>
            service.UpdateAsync(1, new ProductUpdateDto { Id = 1, Name = "Widget", CategoryId = 999 }));

        Assert.Equal("CategoryId", onCreate.Field);
        productRepo.VerifyNoOtherCalls();
    }

    /// <summary>
    /// Test to ensure that a product is created in its category, which is returned with its name.
    /// </summary>
    [Fact]
    public async Task ProductRepository_CreateAsync_ReturnsCategoryName()
    {
        using var context = CreateContext();
        var category = await CreateRepository(context).CreateAsync(new Category { Name = "Tools" });
        var productRepo = new ProductRepository(context, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
        var service = new ProductService(productRepo, CreateRepository(context));

        var created = await service.CreateAsync(new ProductCreateDto
        {
            Name = "Hammer",
            Price = 12m,
            Stock = 3,
            LowStockThreshold = 5,
            CategoryId = category.Id
        });

        Assert.Equal(category.Id, created.CategoryId);
        Assert.Equal("Tools", created.CategoryName);
        Assert.Equal(5, created.LowStockThreshold);

        var fetched = await service.GetByIdAsync(created.Id);
        Assert.Equal("Tools", fetched!.CategoryName);
    }

    // ---------------------------------------------------------------------
    // Controller tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that the controller translates the service results into the right HTTP results.
    /// </summary>
    [Fact]
    public async Task Controller_ReturnsNotFoundForUnknownCategory_AndCreatedAtActionOnCreate()
    {
        var dto = new CategoryRequestDto { Name = "Tools" };
        var service = new Mock<ICategoryService>();
        service.Setup(s => s.CreateAsync(dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CategoryResponseDto { Id = 7, Name = "Tools" });

        var controller = new CategoriesController(service.Object);

        Assert.IsType<NotFoundResult>((await controller.GetById(999)).Result);
        Assert.IsType<NotFoundResult>(await controller.Update(999, dto));
        Assert.IsType<NotFoundResult>(await controller.Delete(999));

        var created = Assert.IsType<CreatedAtActionResult>((await controller.Create(dto)).Result);
        Assert.Equal(nameof(CategoriesController.GetById), created.ActionName);
        Assert.Equal(7, created.RouteValues!["id"]);
    }

    // ---------------------------------------------------------------------
    // API tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test the whole category cycle through the API: create, read, update, use in a product, refused delete, delete.
    /// </summary>
    [Fact]
    public async Task Api_CategoryCycle()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (admin, _) = await factory.CreateAuthenticatedClientAsync();

        var create = await admin.PostAsJsonAsync("/api/v1/categories", new { name = "Tools" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var category = await create.Content.ReadFromJsonAsync<CategoryResponseDto>();
        Assert.Equal($"/api/v1/categories/{category!.Id}", create.Headers.Location?.AbsolutePath);

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PutAsJsonAsync($"/api/v1/categories/{category.Id}", new { name = "Hand tools" })).StatusCode);
        Assert.Equal("Hand tools",
            (await admin.GetFromJsonAsync<CategoryResponseDto>($"/api/v1/categories/{category.Id}"))!.Name);

        var product = await admin.PostAsJsonAsync("/api/v1/products",
            new { name = "Hammer", price = 12, stock = 3, categoryId = category.Id });
        Assert.Equal(HttpStatusCode.Created, product.StatusCode);
        var productId = (await product.Content.ReadFromJsonAsync<ProductResponseDto>())!.Id;

        // The category is used by a product: 409
        var refused = await admin.DeleteAsync($"/api/v1/categories/{category.Id}");
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal(409, (await refused.Content.ReadFromJsonAsync<ProblemDetails>())!.Status);

        // Once the product is gone, the category can be deleted
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/v1/products/{productId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/v1/categories/{category.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/v1/categories/{category.Id}")).StatusCode);
    }

    /// <summary>
    /// Test to ensure that a product with an unknown category is rejected with a validation error on CategoryId.
    /// </summary>
    [Fact]
    public async Task Api_CreateProduct_WithUnknownCategory_ReturnsBadRequest()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (admin, _) = await factory.CreateAuthenticatedClientAsync();

        var response = await admin.PostAsJsonAsync("/api/v1/products",
            new { name = "Hammer", price = 12, stock = 3, categoryId = 999 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("errors").TryGetProperty("CategoryId", out _));
    }

    /// <summary>
    /// Test to ensure that users can read the categories but only admins can change them.
    /// </summary>
    [Fact]
    public async Task Api_Categories_ReadForUsers_WriteForAdmins()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (user, _) = await factory.CreateAuthenticatedClientAsync("User");

        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/v1/categories")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await user.PostAsJsonAsync("/api/v1/categories", new { name = "Tools" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync("/api/v1/categories")).StatusCode);
    }
}
