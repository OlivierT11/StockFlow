using System.ComponentModel.DataAnnotations;

namespace Inventory.DTOs
{
    public sealed record UserListResponseDto
    {
        public IReadOnlyList<UserListItemDto> Users { get; init; } = [];
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int TotalCount { get; init; }

    }
}
