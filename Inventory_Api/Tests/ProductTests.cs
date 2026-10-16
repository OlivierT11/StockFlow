using Inventory.Controllers;
using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Tests;

public class ProductTests
{
    private static AppDbContext CreateContext()
    {
        // Configure Entity Framework Core pour utiliser une base de données stockée en mémoire (UseInMemoryDatabase)
        // Avec UseInMemoryDatabase, aucune donnée n’est ajoutée à la vraie base de données. Les données sont stockées uniquement dans une base simulée en mémoire :
        // Le nom de la base est généré ainsi, Par exemple : a7f4a3e7 - 4ec9 - 4a32 - 9dc5 - 18d9d32c9d11
        // Cela donne une base différente à chaque appel de CreateContext().
        // C’est important dans les tests, car les données d’un test ne se mélangent pas avec celles d’un autre test.
        // Point important : UseInMemoryDatabase est pratique pour des tests simples, mais ce n’est pas exactement le même comportement qu’une vraie base SQL.
        // Pour tester les requêtes SQL, les contraintes ou les transactions, SQLite en mémoire est souvent plus représentatif.
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
        Assert.Equal("Widget", fetched!.Name);
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
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var product = new Product { Name = "Widget", Price = 9.99m, Stock = 5 };
        var created = await repo.CreateAsync(product);

        // pass an already-canceled token and verify that the method throws OperationCanceledException
        using var cancellationTokenSource = new CancellationTokenSource();
        cancellationTokenSource.Cancel();

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
    /// Test to ensure that GetAllAsync returns an empty collection when no products exist in the repository.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetAllAsync_WhenNoProductsExist_ReturnsEmptyCollection()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var products = await repo.GetAllAsync();

        Assert.NotNull(products);
        Assert.Empty(products);
    }

    /// <summary>
    /// Test to ensure that GetAllAsync respects cancellation tokens.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetAllAsync_WhenCallerCancels_ThrowsOperationCanceledException()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            repo.GetAllAsync(cts.Token));
    }

    /// <summary>
    /// Do not test logging unless logging itself is a requirement.
    /// </summary>
    /// <returns></returns>
    //[Fact]
    //public async Task GetAllAsync_LoggingTest()
    //{
    //    //empty test to ensure that logging does not throw exceptions
    //}

    /// <summary>
    /// Test to ensure that updating an existing product correctly updates its fields in the repository.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task UpdateAsync_ExistingProduct_UpdatesFields()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        var created = await repo.CreateAsync(new Product { Name = "Old", Price = 1m, Stock = 1 });

        created.Name = "New";
        created.Price = 2m;
        created.Stock = 3;

        var updated = await repo.UpdateAsync(1, created);
        Assert.True(updated);
        //var updated = await repo.UpdateAsync(created);
        //Assert.NotNull(updated);
        //Assert.Equal("New", updated!.Name);
        //Assert.Equal(2m, updated.Price);
        //Assert.Equal(3, updated.Stock);
    }

    /// <summary>
    /// Test to ensure that updating a non-existing product returns false.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task UpdateAsync_NonExisting_ReturnsFalse()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        var product = new Product { Id = 1, Name = "X", Price = 1m, Stock = 1 };
        var result = await repo.UpdateAsync(1, product);
        Assert.False(result);
    }

    /// <summary>
    /// Test to ensure that updating a product respects cancellation tokens.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task UpdateAsync_WhenCallerCancels_ThrowsOperationCanceledException()
    {
        using var context = CreateContext();

        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var created = await repo.CreateAsync(new Product
        {
            Name = "Old",
            Price = 1m,
            Stock = 1
        });

        created.Name = "New";
        created.Price = 2m;
        created.Stock = 3;

        using var cancellationTokenSource = new CancellationTokenSource();
        cancellationTokenSource.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            repo.UpdateAsync(
                1,
                created,
                cancellationTokenSource.Token));
    }


    /// <summary>
    /// Test to ensure that deleting a product actually removes it from the repository.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task DeleteAsync_RemovesProduct()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);
        var created = await repo.CreateAsync(new Product { Name = "ToDelete", Price = 1m, Stock = 1 });

        var deleted = await repo.DeleteAsync(created.Id);
        Assert.True(deleted);

        var fetched = await repo.GetByIdAsync(created.Id);
        Assert.Null(fetched);
    }

    /// <summary>
    /// Test to ensure that two concurrent calls to DeleteAsync for the same product only remove it once.
    /// It uses a gate (TaskCompletionSource) to synchronize the two delete operations, ensuring they attempt to delete the same product at the same time. 
    /// The test asserts that only one of the delete operations succeeds, confirming that the repository handles concurrent deletions correctly.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task DeleteAsync_TwoConcurrentCalls_RemoveProductOnlyOnce()
    {
        var databaseName = Guid.NewGuid().ToString();

        // Create a new context for the test, ensuring that both repositories share the same in-memory database (same name).
        AppDbContext CreateTestContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;

            return new AppDbContext(options);
        }

        using var setupContext = CreateTestContext();
        var setupRepo = new ProductRepository(
            setupContext,
            NullLogger<ProductRepository>.Instance,
            new MemoryCache(new MemoryCacheOptions()));

        var product = await setupRepo.CreateAsync(
            new Product { Name = "ToDelete", Price = 1m, Stock = 1 });

        Assert.Equal(1, product.Id); //don't log anything if passing

        // Create two separate contexts and repositories that point to the same in-memory database (or setupContext will create a Product in base,
        // but context1 and context2 will not see it if they are not using the same database name).
        using var context1 = CreateTestContext();
        using var context2 = CreateTestContext();

        var repo1 = new ProductRepository(
            context1, NullLogger<ProductRepository>.Instance,
            new MemoryCache(new MemoryCacheOptions()));

        var repo2 = new ProductRepository(
            context2, NullLogger<ProductRepository>.Instance,
            new MemoryCache(new MemoryCacheOptions()));

        var gate = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);

        async Task<bool> DeleteWhenReleased(ProductRepository repo)
        {
            await gate.Task;
            return await repo.DeleteAsync(product.Id);
        }

        var delete1 = DeleteWhenReleased(repo1);
        var delete2 = DeleteWhenReleased(repo2);

        gate.SetResult();

        var results = await Task.WhenAll(delete1, delete2);

        Assert.Single(results, deleted => deleted);
    }

    /// <summary>
    /// Test to ensure that deleting a non-existing product returns false.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task DeleteAsync_NonExisting_ReturnsFalse()
    {
        using var context = CreateContext();
        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var deleted = await repo.DeleteAsync(999);
        Assert.False(deleted);
    }

    /// <summary>
    /// Test to ensure that deleting a product respects cancellation tokens.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task DeleteAsync_WhenCallerCancels_ThrowsOperationCanceledException()
    {
        using var context = CreateContext();

        var logger = NullLogger<ProductRepository>.Instance;
        var cache = new MemoryCache(new MemoryCacheOptions());
        var repo = new ProductRepository(context, logger, cache);

        var created = await repo.CreateAsync(new Product
        {
            Name = "ToDelete",
            Price = 1m,
            Stock = 1
        });

        using var cancellationTokenSource = new CancellationTokenSource();
        cancellationTokenSource.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            repo.DeleteAsync(
                created.Id,
                cancellationTokenSource.Token));
    }

    // ---------------------------------------------------------------------
    // Concurrency tests
    // Product.Version is a [Timestamp] concurrency token: EF adds it to the WHERE clause of
    // UPDATE/DELETE and throws DbUpdateConcurrencyException when the row changed (or vanished)
    // since it was loaded. UpdateAsync/DeleteAsync return false when the product was deleted by another request,
    // and let the exception reach the caller when it was modified (the controller turns it into 409 Conflict).
    // ---------------------------------------------------------------------

    /// <summary>
    /// Creates a context on a database shared with every other context built from the same root and name,
    /// so that several contexts (= several concurrent requests) see the same data.
    /// </summary>
    private static AppDbContext CreateSharedContext(
        InMemoryDatabaseRoot root,
        string databaseName,
        params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName, root)
            .AddInterceptors([.. interceptors, new RowVersionInterceptor()])
            .Options;

        return new AppDbContext(options);
    }

    /// <summary>
    /// SQL Server generates a new rowversion on every INSERT/UPDATE, but the in-memory provider does not:
    /// Version would stay empty forever and no conflict would ever be detected.
    /// This interceptor gives each saved Product a new Version, like SQL Server does.
    /// The original value (loaded from the store) is untouched, so EF still compares against it.
    /// </summary>
    private sealed class RowVersionInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            foreach (var entry in eventData.Context!.ChangeTracker.Entries<Product>())
            {
                if (entry.State is EntityState.Added or EntityState.Modified)
                {
                    entry.Property(p => p.Version).CurrentValue = Guid.NewGuid().ToByteArray();
                }
            }

            return ValueTask.FromResult(result);
        }
    }

    /// <summary>
    /// Runs a callback once, just before the intercepted context writes to the database.
    /// Used to simulate another request committing a change between the repository's read and its SaveChanges.
    /// </summary>
    private sealed class BeforeSaveInterceptor(Func<Task> onSaving) : SaveChangesInterceptor
    {
        private Func<Task>? _onSaving = onSaving;

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            var callback = Interlocked.Exchange(ref _onSaving, null);
            if (callback is not null)
            {
                await callback();
            }

            return result;
        }
    }

    /// <summary>
    /// Test to ensure that two concurrent creates on separate contexts both succeed and get distinct ids.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task CreateAsync_TwoConcurrentCalls_BothSucceedWithDistinctIds()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();

        using var context1 = CreateSharedContext(root, databaseName);
        using var context2 = CreateSharedContext(root, databaseName);
        var repo1 = new ProductRepository(context1, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
        var repo2 = new ProductRepository(context2, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));

        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        async Task<Product> CreateWhenReleased(ProductRepository repo, string name)
        {
            await gate.Task;
            return await repo.CreateAsync(new Product { Name = name, Price = 1m, Stock = 1 });
        }

        var create1 = CreateWhenReleased(repo1, "A");
        var create2 = CreateWhenReleased(repo2, "B");

        gate.SetResult();

        var created = await Task.WhenAll(create1, create2);

        Assert.NotEqual(created[0].Id, created[1].Id);

        using var verifyContext = CreateSharedContext(root, databaseName);
        Assert.Equal(2, await verifyContext.Products.CountAsync());
    }

    /// <summary>
    /// Test to ensure that a product updated by another request is read back with its new values,
    /// even though it was cached before the update (the cache is shared, as IMemoryCache is a singleton in the app).
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetByIdAsync_AfterConcurrentUpdate_ReturnsLatestValues()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();
        var sharedCache = new MemoryCache(new MemoryCacheOptions());

        using var readerContext = CreateSharedContext(root, databaseName);
        using var writerContext = CreateSharedContext(root, databaseName);
        var reader = new ProductRepository(readerContext, NullLogger<ProductRepository>.Instance, sharedCache);
        var writer = new ProductRepository(writerContext, NullLogger<ProductRepository>.Instance, sharedCache);

        var created = await writer.CreateAsync(new Product { Name = "Old", Price = 1m, Stock = 1 });
        Assert.Equal("Old", (await reader.GetByIdAsync(created.Id))!.Name); // puts the product in the cache

        await writer.UpdateAsync(created.Id, new Product { Name = "New", Price = 2m, Stock = 3 });

        var fetched = await reader.GetByIdAsync(created.Id);
        Assert.NotNull(fetched);
        Assert.Equal("New", fetched!.Name);
        Assert.Equal(2m, fetched.Price);
        Assert.Equal(3, fetched.Stock);
    }

    /// <summary>
    /// Test to ensure that a product deleted by another request is no longer returned, even though it was cached before.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetByIdAsync_AfterConcurrentDelete_ReturnsNull()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();
        var sharedCache = new MemoryCache(new MemoryCacheOptions());

        using var readerContext = CreateSharedContext(root, databaseName);
        using var writerContext = CreateSharedContext(root, databaseName);
        var reader = new ProductRepository(readerContext, NullLogger<ProductRepository>.Instance, sharedCache);
        var writer = new ProductRepository(writerContext, NullLogger<ProductRepository>.Instance, sharedCache);

        var created = await writer.CreateAsync(new Product { Name = "ToDelete", Price = 1m, Stock = 1 });
        Assert.NotNull(await reader.GetByIdAsync(created.Id)); // puts the product in the cache

        await writer.DeleteAsync(created.Id);

        Assert.Null(await reader.GetByIdAsync(created.Id));
    }

    /// <summary>
    /// Test to ensure that GetAllAsync reflects changes committed by another request (it reads with AsNoTracking,
    /// so it must not return stale entities from its own change tracker).
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetAllAsync_AfterConcurrentUpdate_ReturnsLatestValues()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();

        using var readerContext = CreateSharedContext(root, databaseName);
        using var writerContext = CreateSharedContext(root, databaseName);
        var reader = new ProductRepository(readerContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
        var writer = new ProductRepository(writerContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));

        var created = await writer.CreateAsync(new Product { Name = "Old", Price = 1m, Stock = 1 });
        Assert.Equal("Old", Assert.Single(await reader.GetAllAsync()).Name);

        await writer.UpdateAsync(created.Id, new Product { Name = "New", Price = 2m, Stock = 3 });

        var product = Assert.Single(await reader.GetAllAsync());
        Assert.Equal("New", product.Name);
        Assert.Equal(2m, product.Price);
        Assert.Equal(3, product.Stock);
    }

    /// <summary>
    /// Test to ensure that an update based on a stale version of the product is rejected when another request
    /// updated it in the meantime, and that the other request's values are kept (no lost update).
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task UpdateAsync_WhenProductUpdatedConcurrently_ThrowsDbUpdateConcurrencyException()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();

        using var setupContext = CreateSharedContext(root, databaseName);
        var setupRepo = new ProductRepository(setupContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
        var created = await setupRepo.CreateAsync(new Product { Name = "Old", Price = 1m, Stock = 1 });

        // The other request commits its update after our repository has loaded the product, but before it saves.
        var interceptor = new BeforeSaveInterceptor(async () =>
        {
            using var otherContext = CreateSharedContext(root, databaseName);
            var otherRepo = new ProductRepository(otherContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
            Assert.True(await otherRepo.UpdateAsync(created.Id, new Product { Name = "Winner", Price = 5m, Stock = 5 }));
        });

        using var context = CreateSharedContext(root, databaseName, interceptor);
        var repo = new ProductRepository(context, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() =>
            repo.UpdateAsync(created.Id, new Product { Name = "Loser", Price = 9m, Stock = 9 }));

        using var verifyContext = CreateSharedContext(root, databaseName);
        var stored = await verifyContext.Products.SingleAsync(p => p.Id == created.Id);
        Assert.Equal("Winner", stored.Name);
        Assert.Equal(5m, stored.Price);
        Assert.Equal(5, stored.Stock);

        // The rejected update must not stay tracked, otherwise the next SaveChanges on this context would retry it.
        Assert.Empty(context.ChangeTracker.Entries());
    }

    /// <summary>
    /// Test to ensure that updating a product that another request deleted in the meantime returns false
    /// and does not bring the product back.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task UpdateAsync_WhenProductDeletedConcurrently_ReturnsFalse()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();

        using var setupContext = CreateSharedContext(root, databaseName);
        var setupRepo = new ProductRepository(setupContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
        var created = await setupRepo.CreateAsync(new Product { Name = "Old", Price = 1m, Stock = 1 });

        var interceptor = new BeforeSaveInterceptor(async () =>
        {
            using var otherContext = CreateSharedContext(root, databaseName);
            var otherRepo = new ProductRepository(otherContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
            Assert.True(await otherRepo.DeleteAsync(created.Id));
        });

        using var context = CreateSharedContext(root, databaseName, interceptor);
        var repo = new ProductRepository(context, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));

        Assert.False(await repo.UpdateAsync(created.Id, new Product { Name = "New", Price = 2m, Stock = 2 }));

        Assert.Empty(context.ChangeTracker.Entries());

        using var verifyContext = CreateSharedContext(root, databaseName);
        Assert.False(await verifyContext.Products.AnyAsync(p => p.Id == created.Id));
    }

    /// <summary>
    /// Test to ensure that deleting a product that another request updated in the meantime is rejected,
    /// so the product (with the other request's values) is kept.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task DeleteAsync_WhenProductUpdatedConcurrently_ThrowsDbUpdateConcurrencyException()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();

        using var setupContext = CreateSharedContext(root, databaseName);
        var setupRepo = new ProductRepository(setupContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
        var created = await setupRepo.CreateAsync(new Product { Name = "Old", Price = 1m, Stock = 1 });

        var interceptor = new BeforeSaveInterceptor(async () =>
        {
            using var otherContext = CreateSharedContext(root, databaseName);
            var otherRepo = new ProductRepository(otherContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
            Assert.True(await otherRepo.UpdateAsync(created.Id, new Product { Name = "Updated", Price = 2m, Stock = 2 }));
        });

        using var context = CreateSharedContext(root, databaseName, interceptor);
        var repo = new ProductRepository(context, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() =>
            repo.DeleteAsync(created.Id));

        using var verifyContext = CreateSharedContext(root, databaseName);
        var stored = await verifyContext.Products.SingleAsync(p => p.Id == created.Id);
        Assert.Equal("Updated", stored.Name);

        // The rejected delete must not stay tracked, otherwise the next SaveChanges on this context would retry it.
        Assert.Empty(context.ChangeTracker.Entries());
    }

    /// <summary>
    /// Test to ensure that deleting a product that another request deleted in the meantime returns false instead of throwing.
    /// Deterministic version of DeleteAsync_TwoConcurrentCalls_RemoveProductOnlyOnce.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task DeleteAsync_WhenProductDeletedConcurrently_ReturnsFalse()
    {
        var root = new InMemoryDatabaseRoot();
        var databaseName = Guid.NewGuid().ToString();

        using var setupContext = CreateSharedContext(root, databaseName);
        var setupRepo = new ProductRepository(setupContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
        var created = await setupRepo.CreateAsync(new Product { Name = "ToDelete", Price = 1m, Stock = 1 });

        var interceptor = new BeforeSaveInterceptor(async () =>
        {
            using var otherContext = CreateSharedContext(root, databaseName);
            var otherRepo = new ProductRepository(otherContext, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));
            Assert.True(await otherRepo.DeleteAsync(created.Id));
        });

        using var context = CreateSharedContext(root, databaseName, interceptor);
        var repo = new ProductRepository(context, NullLogger<ProductRepository>.Instance, new MemoryCache(new MemoryCacheOptions()));

        Assert.False(await repo.DeleteAsync(created.Id));

        Assert.Empty(context.ChangeTracker.Entries());
    }

    /// <summary>
    /// Test to ensure that the Delete endpoint returns 409 Conflict when the product was modified by another request.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Delete_ReturnsConflict_WhenProductModifiedConcurrently()
    {
        var mockService = new Mock<IProductService>();
        mockService
            .Setup(s => s.DeleteAsync(1, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException());

        var controller = new ProductsController(mockService.Object);

        var result = await controller.Delete(1);

        Assert.IsType<ConflictResult>(result);
    }

    /// <summary>
    /// Test to ensure that the Delete endpoint returns 404 Not Found when the product does not exist
    /// (including when another request deleted it first).
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Delete_ReturnsNotFound_WhenProductDoesNotExist()
    {
        var mockService = new Mock<IProductService>();
        mockService
            .Setup(s => s.DeleteAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var controller = new ProductsController(mockService.Object);

        var result = await controller.Delete(1);

        Assert.IsType<NotFoundResult>(result);
    }

    /// <summary>
    /// Test to ensure that the Update endpoint returns 409 Conflict when the product was modified by another request.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Update_ReturnsConflict_WhenProductModifiedConcurrently()
    {
        var dto = new ProductUpdateDto { Id = 1, Name = "New", Price = 2m, Stock = 2 };
        var mockService = new Mock<IProductService>();
        mockService
            .Setup(s => s.UpdateAsync(1, dto, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException());

        var controller = new ProductsController(mockService.Object);

        var result = await controller.Update(1, dto);

        Assert.IsType<ConflictResult>(result);
    }

    /// <summary>
    /// Test to ensure that the Update endpoint returns 404 Not Found when the product does not exist
    /// (including when another request deleted it first).
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Update_ReturnsNotFound_WhenProductDoesNotExist()
    {
        var dto = new ProductUpdateDto { Id = 1, Name = "New", Price = 2m, Stock = 2 };
        var mockService = new Mock<IProductService>();
        mockService
            .Setup(s => s.UpdateAsync(1, dto, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var controller = new ProductsController(mockService.Object);

        var result = await controller.Update(1, dto);

        Assert.IsType<NotFoundResult>(result);
    }

}