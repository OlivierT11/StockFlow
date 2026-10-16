using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs
{
    public sealed record UserSearchQueryDto
    {
        [StringLength(100, ErrorMessage = "Display name is too long.")]
        public string DisplayName { get; init; } = string.Empty;

        [RegularExpression("user|admin|guest", ErrorMessage = "Role must be 'user', 'admin', or 'guest'.")]
        public string Role { get; init; } = string.Empty;

        public int Page { get; init; } = 1;

        public int PageSize { get; init; } = 10;

    }
}