using Inventory.DTOs;
using Inventory.Models;
using Microsoft.AspNetCore.Identity.Data;

namespace Inventory.Repositories
{
    public interface IAuthRepository
    {
        Task<User?> LogUserAsync(
            User user,
            CancellationToken cancellationToken = default);

        Task<string> IssueRefreshTokenAsync(
            User user,
            CancellationToken cancellationToken = default); 

        Task<(User User, string RefreshToken)?> RefreshTokenAsync(
            RefreshRequest request,
            CancellationToken cancellationToken = default);

        Task<bool> RevokeRefreshTokenAsync(
            string refreshToken,
            CancellationToken cancellationToken = default);

        Task<bool> AddUserAsync(
            User newUser,
            CancellationToken cancellationToken = default);
    }

}
