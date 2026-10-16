using Azure.Core;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;


namespace Inventory.Services
{
    public class AuthService : IAuthService
    {
        private readonly JwtTokenService _jwtTokenService;
        private readonly IMemoryCache _cache;
        private readonly IAuthRepository _authRepository;
        private readonly IPasswordHasher<User> _passwordHasher;

        public AuthService(
            JwtTokenService tokenService,
            IAuthRepository authRepository,
            IMemoryCache cache,
            IPasswordHasher<User> passwordHasher)
        {
            _jwtTokenService = tokenService;
            _authRepository = authRepository;
            _cache = cache;
            _passwordHasher = passwordHasher;
        }

        /// <summary>
        /// Logs in a user by validating their credentials and returning a JWT token and refresh token if successful.
        /// </summary>
        /// <param name="loginDto"></param>
        /// <param name="cancellationToken"></param>
        /// <returns></returns>
        /// <exception cref="ArgumentException"></exception>
        public async Task<string[]?> LogUserAsync(LoginDto loginDto, CancellationToken cancellationToken = default)
        {
            //string cacheKey = $"user:{loginDto.Email}";

            //if (_cache.TryGetValue<bool>(cacheKey, out var cachedUser))
            //{
            //    Console.WriteLine("Value used from cache.");
            //    return cachedUser;
            //}

            if (string.IsNullOrWhiteSpace(loginDto.Password))
            {
                throw new ArgumentException("Password is required.");
            }

            if (string.IsNullOrWhiteSpace(loginDto.Email))
            {
                throw new ArgumentException("Email is required.");
            }

            // convert DTO to model
            var user = new User
            {
                Email = loginDto.Email
            };

            var result = await _authRepository.LogUserAsync(user, cancellationToken);

            if (result is null)
            {
                return null;
            }

            if (result.IsActive == false)
            {
                return null;
            }


            //if (user != null)
            //{
            //    _cache.Set(
            //        cacheKey,
            //        product,
            //        TimeSpan.FromMinutes(5));
            //}

            /*
                IPasswordHasher<TUser>.HashPassword(...) uses ASP.NET Core Identity’s password-hashing format. By default, it uses PBKDF2 with:
                    HMAC-SHA512
                    A randomly generated 128-bit salt
                    A 256-bit derived key
                    100,000 iterations
                    An Identity V3 format marker and metadata stored with the result

             */
            var passwordIsValid = _passwordHasher.VerifyHashedPassword(
                result,
                result.PasswordHash,
                loginDto.Password);


            if (passwordIsValid == PasswordVerificationResult.Failed)
            {
                return null;
            }

            string jwtToken = _jwtTokenService.CreateToken(
                result.Id,
                result.Email,
                result.Role);

            string refreshToken = await _authRepository.IssueRefreshTokenAsync(result, cancellationToken);
            return new[] { jwtToken, refreshToken };

        }

        /// <summary>
        /// Refreshes the access token using a valid refresh token.
        /// </summary>
        /// <param name="request"></param>
        /// <param name="cancellationToken"></param>
        /// <returns></returns>
        /// <exception cref="ArgumentException"></exception>
        public async Task<string[]?> RefreshTokenAsync(RefreshRequest request, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                throw new ArgumentException("Refresh token is required.");
            }

            // Tests the validity of the refresh token.
            var refreshed = await _authRepository.RefreshTokenAsync(request, cancellationToken);
            if (refreshed is null)
            {
                return null;
            }

            // If the refresh token is valid, generate a new access token AND refresh token.
            var user = refreshed.Value.User;
            var accessToken = _jwtTokenService.CreateToken(
                user.Id,
                user.Email,
                user.Role);

            return new[] { accessToken, refreshed.Value.RefreshToken };
        }

        public Task<bool> RevokeRefreshTokenAsync(
            string refreshToken,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                // Safely reject blank or whitespace-only token values.
                return Task.FromResult(false);
            }

            return _authRepository.RevokeRefreshTokenAsync(refreshToken, cancellationToken);
        }

        /// <summary>
        /// Adds a new user to the system after validating the input and hashing the password.
        /// </summary>
        /// <param name="registerDto"></param>
        /// <param name="cancellationToken"></param>
        /// <returns></returns>
        /// <exception cref="ArgumentException"></exception>
        public async Task<bool> AddUserAsync(CreateUserDTO registerDto, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(registerDto.Password))
            {
                throw new ArgumentException("Password is required.");
            }
            if (string.IsNullOrWhiteSpace(registerDto.Email))
            {
                throw new ArgumentException("Email is required.");
            }

            // convert DTO to model
            var newUser = new User
            {
                Email = registerDto.Email,
                Username = registerDto.Username
            };

            var result = await _authRepository.LogUserAsync(newUser, cancellationToken);
            if (result != null)
            {
                return false; // User already exists
            }

            newUser.PasswordHash = _passwordHasher.HashPassword(newUser, registerDto.Password);
            await _authRepository.AddUserAsync(newUser, cancellationToken);
            return true;
        }
    }
}
