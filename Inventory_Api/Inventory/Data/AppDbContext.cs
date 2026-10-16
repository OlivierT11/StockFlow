using Microsoft.EntityFrameworkCore;
using Inventory.Models;

namespace Inventory.Data
{
    /// <summary>
    /// The Entity Framework Core context of the application.
    /// </summary>
    public class AppDbContext : DbContext
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="AppDbContext"/> class.
        /// </summary>
        /// <param name="options">The context options (database provider, connection string...).</param>
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        /// <summary>Gets the products.</summary>
        public DbSet<Product> Products => Set<Product>();

        /// <summary>Gets the users.</summary>
        public DbSet<User> Users => Set<User>();

        /// <summary>Gets the refresh tokens.</summary>
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

        /// <summary>Gets the product categories.</summary>
        public DbSet<Category> Categories => Set<Category>();

        /// <summary>Gets the warehouses.</summary>
        public DbSet<Warehouse> Warehouses => Set<Warehouse>();

        /// <summary>Gets the stock movements.</summary>
        public DbSet<StockMovement> StockMovements => Set<StockMovement>();

        /// <inheritdoc />
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // A category that still has products cannot be deleted (the service returns 409 before reaching the database).
            modelBuilder.Entity<Product>()
                .HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            // Movements are the stock history: neither the product, the warehouse nor the user can be deleted while they have some.
            modelBuilder.Entity<StockMovement>()
                .HasOne(m => m.Product)
                .WithMany(p => p.StockMovements)
                .HasForeignKey(m => m.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StockMovement>()
                .HasOne(m => m.Warehouse)
                .WithMany(w => w.StockMovements)
                .HasForeignKey(m => m.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StockMovement>()
                .HasOne(m => m.User)
                .WithMany()
                .HasForeignKey(m => m.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Stored as "In" / "Out" / "Adjustment" rather than 0 / 1 / 2, so the table stays readable.
            modelBuilder.Entity<StockMovement>()
                .Property(m => m.Type)
                .HasConversion<string>()
                .HasMaxLength(20);

            // The dates are written in UTC, but datetime2 does not store the kind: without this converter they would be
            // read back as Unspecified and serialized without the trailing "Z", so clients would take them for local times.
            modelBuilder.Entity<StockMovement>()
                .Property(m => m.Date)
                .HasConversion(
                    date => date,
                    date => DateTime.SpecifyKind(date, DateTimeKind.Utc));

            // Movement lists are filtered by period and sorted by date.
            modelBuilder.Entity<StockMovement>()
                .HasIndex(m => m.Date);
        }
    }
}
