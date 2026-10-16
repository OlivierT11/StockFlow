using Inventory.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Tests;

public class MigrationTests
{
    /// <summary>
    /// The migrations are generated for SQL Server, so they must be checked with the SQL Server provider:
    /// with another provider (e.g. SQLite) the column types differ and EF reports changes that do not exist.
    /// No connection is opened: these tests only compare the model with the migrations and generate SQL.
    /// </summary>
    private static AppDbContext CreateSqlServerContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=unused;Database=unused")
            .Options;

        return new AppDbContext(options);
    }

    /// <summary>
    /// Test to ensure that every model change is covered by a migration.
    /// CD applies the migrations to Azure SQL, so a forgotten migration would leave production out of sync with the code.
    /// </summary>
    [Fact]
    public void Model_HasNoPendingChanges()
    {
        using var context = CreateSqlServerContext();

        Assert.False(
            context.Database.HasPendingModelChanges(),
            "The model has changes that are not in a migration. Run: dotnet ef migrations add <Name>");
    }

    /// <summary>
    /// Migration test.
    /// Test to ensure that the database migrations create the expected schema.
    /// </summary>
    [Fact]
    public void Migrations_CreateExpectedSchema()
    {
        using var context = CreateSqlServerContext();

        // SQL script that applies every migration to an empty database (same as: dotnet ef migrations script).
        var script = context.GetService<IMigrator>().GenerateScript();

        Assert.Contains("CREATE TABLE [Products]", script);
        Assert.Contains("CREATE TABLE [Users]", script);
        Assert.Contains("CREATE TABLE [RefreshTokens]", script);

        // Concurrency tokens ([Timestamp]) used by the optimistic concurrency checks.
        Assert.Contains("ALTER TABLE [Products] ADD [Version] rowversion NOT NULL", script);
        Assert.Contains("ALTER TABLE [Users] ADD [Version] rowversion NOT NULL", script);
    }

}
