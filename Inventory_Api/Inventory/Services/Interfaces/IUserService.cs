using Inventory.DTOs;
using Inventory.Models;
using Microsoft.AspNetCore.Identity.Data;

namespace Inventory.Services
{
    public interface IUserService
    {
        Task<UserListResponseDto> GetUsersAsync(
            UserSearchQueryDto queryDto,
            CancellationToken cancellationToken = default);

        Task<bool> UpdateUserRoleAsync(
            int id,
            string role,
            CancellationToken cancellationToken = default);

        Task<bool> DisableUserAsync(
            int id,
            CancellationToken cancellationToken = default);

    }
}
