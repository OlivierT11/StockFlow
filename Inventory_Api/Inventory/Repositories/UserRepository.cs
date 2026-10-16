using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Utils;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace Inventory.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly AppDbContext _context;
        private readonly DbSet<User> _user;
        private readonly ILogger<UserRepository> _logger;
        private readonly TimeSpan _timeout;

        public UserRepository(
            AppDbContext context,
            ILogger<UserRepository> logger,
            TimeSpan? timeout = null)
        {
            _context = context;
            _user = context.Set<User>();
            _logger = logger;
            _timeout = timeout ?? TimeSpan.FromSeconds(10);
        }

        public async Task<UserListResponseDto> GetUsersAsync(
            UserSearchQueryDto queryDto,
            CancellationToken cancellationToken = default)
        {
            // timeout token
            using var timeoutCts = new CancellationTokenSource(_timeout);

            // link the cancellation token with the timeout token
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                var result = _context.Users
                .AsNoTracking()
                .Where(user => user.Username.Contains(queryDto.DisplayName))
                .Where(user => user.Role == queryDto.Role)
                .Select(user => new UserListItemDto
                {
                    Id = user.Id,
                    DisplayName = user.Username,
                    Role = user.Role
                });

                var totalItems = await result.CountAsync(linkedCts.Token);
                var users = await result
                    .Skip((queryDto.Page - 1) * queryDto.PageSize)  
                    .Take(queryDto.PageSize) 
                    .ToListAsync(linkedCts.Token);

                var userListResponseDto = new UserListResponseDto
                {
                    Users = users,
                    Page = queryDto.Page,
                    PageSize = queryDto.PageSize,
                    TotalCount = totalItems
                };

                return userListResponseDto;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Get users was canceled by the caller");

                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Get users timed out");

                throw;
            }
        }

        public async Task<bool> UpdateUserRoleAsync(
            int id,
            string role,
            CancellationToken cancellationToken = default)
        {
            // timeout token
            using var timeoutCts = new CancellationTokenSource(_timeout);

            // link the cancellation token with the timeout token
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                var user = await _user.FirstOrDefaultAsync(u => u.Id == id, linkedCts.Token);
                if (user is null)
                {
                    return false;
                }

                user.Role = role;
                await _context.SaveChangesAsync(linkedCts.Token);
                return true;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Update user role was canceled by the caller");

                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Update user role timed out");

                throw;
            }
        }

        public async Task<bool> DisableUserAsync(
            int id,
            CancellationToken cancellationToken = default)
        {
            // timeout token
            using var timeoutCts = new CancellationTokenSource(_timeout);

            // link the cancellation token with the timeout token
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                var user = await _user.FirstOrDefaultAsync(u => u.Id == id, linkedCts.Token);
                if (user is null)
                {
                    return false;
                }

                user.IsActive = false;
                await _context.SaveChangesAsync(linkedCts.Token);
                return true;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Disable user was canceled by the caller");

                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Disable user timed out");

                throw;
            }
        }

    }
}
