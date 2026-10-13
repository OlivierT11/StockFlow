using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Inventory.Models;

public class Product
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }

    public int Stock { get; set; }

    // concurrency token for optimistic concurrency control
    [Timestamp]
    public byte[] Version { get; set; } = Array.Empty<byte>();

    //[MaxLength(50)]
    //public string SKU { get; set; } = string.Empty;

    //[MaxLength(500)]
    //public string? Description { get; set; }

    //public int ReorderLevel { get; set; }

    //public bool IsActive { get; set; } = true;

    //public int CategoryId { get; set; }
    //public Category Category { get; set; } = null!;

    //public int? SupplierId { get; set; }
    //public Supplier? Supplier { get; set; }

    //public ICollection<InventoryItem> InventoryItems { get; set; } = [];
    //public ICollection<StockMovement> StockMovements { get; set; } = [];
}

//public class Category
//{
//    public int Id { get; set; }

//    [Required]
//    [MaxLength(100)]
//    public string Name { get; set; } = string.Empty;

//    public ICollection<Product> Products { get; set; } = [];
//}

//public class Supplier
//{
//    public int Id { get; set; }

//    [Required]
//    [MaxLength(150)]
//    public string Name { get; set; } = string.Empty;

//    [MaxLength(150)]
//    public string? ContactName { get; set; }

//    [EmailAddress]
//    [MaxLength(150)]
//    public string? Email { get; set; }

//    [MaxLength(30)]
//    public string? Phone { get; set; }

//    public ICollection<Product> Products { get; set; } = [];
//}

//public class Warehouse
//{
//    public int Id { get; set; }

//    [Required]
//    [MaxLength(100)]
//    public string Name { get; set; } = string.Empty;

//    [MaxLength(250)]
//    public string? Address { get; set; }

//    public ICollection<InventoryItem> InventoryItems { get; set; } = [];
//    public ICollection<StockMovement> StockMovements { get; set; } = [];
//}

//public class InventoryItem
//{
//    public int Id { get; set; }

//    public int ProductId { get; set; }
//    public Product Product { get; set; } = null!;

//    public int WarehouseId { get; set; }
//    public Warehouse Warehouse { get; set; } = null!;

//    public int Stock { get; set; }

//    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
//}

//public class StockMovement
//{
//    public int Id { get; set; }

//    public int ProductId { get; set; }
//    public Product Product { get; set; } = null!;

//    public int WarehouseId { get; set; }
//    public Warehouse Warehouse { get; set; } = null!;

//    public StockMovementType Type { get; set; }

//    public int Stock { get; set; }

//    [MaxLength(250)]
//    public string? Notes { get; set; }

//    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
//}

//public enum StockMovementType
//{
//    Purchase,
//    Sale,
//    Return,
//    Adjustment,
//    TransferIn,
//    TransferOut
//}