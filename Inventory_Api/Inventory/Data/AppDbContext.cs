using Microsoft.EntityFrameworkCore;
using Inventory.Models;

namespace Inventory.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<Product> Products => Set<Product>();
        public DbSet<User> Users => Set<User>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        //public DbSet<Category> Categories => Set<Category>();
        //public DbSet<Supplier> Suppliers => Set<Supplier>();
        //public DbSet<Warehouse> Warehouses => Set<Warehouse>();
        //public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
        //public DbSet<StockMovement> StockMovements => Set<StockMovement>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);


            //modelBuilder.Entity<Product>()
            //    .HasIndex(p => p.SKU)
            //    .IsUnique();

            //modelBuilder.Entity<InventoryItem>()
            //    .HasIndex(i => new { i.ProductId, i.WarehouseId })
            //    .IsUnique();

            //modelBuilder.Entity<Product>()
            //    .HasOne(p => p.Supplier)
            //    .WithMany(s => s.Products)
            //    .HasForeignKey(p => p.SupplierId)
            //    .OnDelete(DeleteBehavior.SetNull);

            //modelBuilder.Entity<Product>()
            //    .HasOne(p => p.Category)
            //    .WithMany(c => c.Products)
            //    .HasForeignKey(p => p.CategoryId)
            //    .OnDelete(DeleteBehavior.Restrict);

            //modelBuilder.Entity<StockMovement>()
            //    .Property(s => s.Type)
            //    .HasConversion<string>();
        }
    }
}