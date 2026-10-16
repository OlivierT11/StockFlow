using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs
{
    public sealed record UserListItemDto
    {
        public int Id { get; init; }
        public string DisplayName { get; init; } = string.Empty;
        public string Role { get; init; } = "user";

    }
}