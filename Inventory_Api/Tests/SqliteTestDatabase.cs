using Inventory.Data;
using Inventory.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Tests;

/// <summary>
/// An in-memory SQLite database, for the tests that need real transactions and constraints
/// (the EF in-memory provider ignores transactions, so it cannot show a rollback, and does not check foreign keys).
/// The schema is created from the model with EnsureCreated: the migrations are written for SQL Server.
/// The database lives as long as its connection, i.e. until this object is disposed; every context shares it.
/// </summary>
internal sealed class SqliteTestDatabase : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public SqliteTestDatabase()
    {
        _connection.Open();

        using var context = CreateContext();
        context.Database.EnsureCreated();
    }

    /// <summary>
    /// Creates a context on the shared database. The interceptors run before the RowVersionInterceptor.
    /// </summary>
    public AppDbContext CreateContext(params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors([.. interceptors, new RowVersionInterceptor()])
            .Options;

        return new SqliteAppDbContext(options);
    }

    public void Dispose() => _connection.Dispose();

    /// <summary>
    /// SQLite has no rowversion type: the Version columns are plain blobs, filled by the RowVersionInterceptor
    /// instead of the database. They stay concurrency tokens, so EF still adds them to the WHERE clause of UPDATE/DELETE.
    /// </summary>
    private sealed class SqliteAppDbContext(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Product>().Property(p => p.Version).ValueGeneratedNever();
            modelBuilder.Entity<User>().Property(u => u.Version).ValueGeneratedNever();
        }
    }

    /// <summary>
    /// Gives each saved product a new Version, as SQL Server does on every INSERT/UPDATE.
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
}
