using Inventory.DTOs;
using Inventory.Models;
using Microsoft.AspNetCore.Identity.Data;

namespace Inventory.Services
{
    public interface IAuthService
    {
        Task<string[]> LogUserAsync(
            LoginDto loginDto,
            CancellationToken cancellationToken = default);

        Task<string[]> RefreshTokenAsync(
            RefreshRequest request,
            CancellationToken cancellationToken = default);

        Task<bool> RevokeRefreshTokenAsync(
            string refreshToken,
            CancellationToken cancellationToken = default);

        Task<bool> AddUserAsync(
            CreateUserDTO registerDto,
            CancellationToken cancellationToken = default);
    }
}
