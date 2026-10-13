using Inventory.Data;
using Inventory.Models;
using Microsoft.EntityFrameworkCore;

namespace Tests;

public class UnitTest_Migrations
{
    /// <summary>
    /// Migration test.
    /// Test to ensure that the database migrations create the expected schema and allow basic CRUD operations.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Migrations_CreateExpectedSchema()
    {
        // Use a file-based SQLite database for testing migrations, as it behaves more like a real database than InMemory.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=migration-test.db") // This will create the file if not exists.
            .Options;

        using var context = new AppDbContext(options);

        // Apply migrations to the database. This will create the database file and apply all pending migrations.
        await context.Database.MigrateAsync();

        // Verify that the database can be connected to and that the schema is as expected.
        Assert.True(await context.Database.CanConnectAsync());

        var product = new Product
        {
            Name = "Test",
            Price = 1m,
            Stock = 1
        };

        context.Products.Add(product);
        await context.SaveChangesAsync();

        Assert.NotEqual(0, product.Id);

        // Clean up: delete the database file after the test to avoid leaving test artifacts.
        if (File.Exists("migration-test.db"))
            File.Delete("migration-test.db");
    }

}
