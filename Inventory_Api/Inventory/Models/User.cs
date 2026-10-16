using System.ComponentModel.DataAnnotations;

namespace Inventory.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; }

        [Required]
        [MaxLength(512)]
        public string PasswordHash { get; set; }

        [Required]
        [MaxLength(100)]
        public string Email { get; set; }

        [Required]
        [MaxLength(255)]
        public string Role { get; set; } = "user";

        public bool IsActive { get; set; } = true;

        // concurrency token for optimistic concurrency control
        [Timestamp]
        public byte[] Version { get; set; } = Array.Empty<byte>();
    }
}
