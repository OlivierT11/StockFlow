using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Utils;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace Inventory.Repositories
{
    public class AuthRepository : IAuthRepository
    {
        private readonly AppDbContext _context;
        private readonly DbSet<User> _user;
        private readonly DbSet<RefreshToken> _refreshToken;
        private readonly ILogger<ProductRepository> _logger;
        private readonly TimeSpan _timeout;

        public AuthRepository(
            AppDbContext context,
            ILogger<ProductRepository> logger,
            TimeSpan? timeout = null)
        {
            _context = context;
            _user = context.Set<User>();
            _refreshToken = context.Set<RefreshToken>();
            _logger = logger;
            _timeout = timeout ?? TimeSpan.FromSeconds(10);
        }

        /// <summary>
        /// Logs in a user by checking their email and password against the database.
        /// </summary>
        /// <param name="user">The login credentials.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The authenticated user if the credentials are valid, null otherwise.</returns>
        public async Task<User?> LogUserAsync(
            User user,
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
                return await _user
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Email == user.Email, linkedCts.Token);
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Log user was canceled by the caller");

                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Log user timed out");

                throw;
            }
        }

        public async Task<string> IssueRefreshTokenAsync(
            User user,
            CancellationToken cancellationToken = default)
        {
            var refreshToken = Cryptography.CreateRefreshToken();

            _refreshToken.Add(new RefreshToken
            {
                TokenHash = Cryptography.HashToken(refreshToken),
                UserId = user.Id,
                ExpiresAtUtc = DateTime.UtcNow.AddDays(14)
            });

            await _context.SaveChangesAsync(cancellationToken);

            return refreshToken;
        }

        /// <summary>
        /// Refreshes a user's refresh token. If the provided refresh token is valid and not expired or revoked, it revokes the old token and issues a new one.
        /// </summary>
        /// <param name="request"></param>
        /// <param name="cancellationToken"></param>
        /// <returns></returns>
        public async Task<(User User, string RefreshToken)?> RefreshTokenAsync(
            RefreshRequest request,
            CancellationToken cancellationToken = default)
        {
            var stored = await _refreshToken
                .SingleOrDefaultAsync(
                    t => t.TokenHash == Cryptography.HashToken(request.RefreshToken),
                    cancellationToken);

            // If the stored refresh token is null, revoked, or expired, return null
            if (stored is null ||
                stored.RevokedAtUtc is not null ||
                stored.ExpiresAtUtc <= DateTime.UtcNow)
            {
                return null;
            }

            // Retrieve the user associated with the refresh token, in order to create a new token from its claims.
            var user = await _user.FindAsync([stored.UserId], cancellationToken);
            if (user is null)
                return null;
            if(!user.IsActive)
                return null;

            // Rotation: Revoke the old refresh token and issue a new one
            stored.RevokedAtUtc = DateTime.UtcNow;

            var newRefreshToken = Cryptography.CreateRefreshToken();

            _refreshToken.Add(new RefreshToken
            {
                TokenHash = Cryptography.HashToken(newRefreshToken),
                UserId = user.Id,
                ExpiresAtUtc = DateTime.UtcNow.AddDays(14)
            });

            await _context.SaveChangesAsync(cancellationToken);
            return (user, newRefreshToken);
        }

        public async Task<bool> RevokeRefreshTokenAsync(
            string refreshToken,
            CancellationToken cancellationToken = default)
        {
            var tokenHash = Cryptography.HashToken(refreshToken);
            var stored = await _refreshToken
                .SingleOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

            if (stored is null || stored.RevokedAtUtc is not null)
            {
                return false;
            }

            stored.RevokedAtUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }


        /// <summary>
        /// Adds a new user to the database.
        /// </summary>
        /// <param name="newUser">The user to add.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>A task representing the asynchronous operation.</returns>
        public async Task<bool> AddUserAsync(
            User newUser,
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
                await _user.AddAsync(newUser, linkedCts.Token);
                await _context.SaveChangesAsync(linkedCts.Token);
                return true;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Add user was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Add user timed out");
                throw;
            }
        }
    }
}
