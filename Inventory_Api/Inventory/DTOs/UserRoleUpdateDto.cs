using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs
{
    public sealed record UserRoleUpdateDto
    {
        [RegularExpression("user|admin|guest", ErrorMessage = "Role must be 'user', 'admin', or 'guest'.")]
        public string Role { get; init; } = string.Empty;
    }
}
