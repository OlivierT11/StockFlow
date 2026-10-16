using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Microsoft.Extensions.Caching.Memory;


namespace Inventory.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepository;

        public UserService(
            IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<UserListResponseDto> GetUsersAsync(UserSearchQueryDto queryDto, CancellationToken cancellationToken = default)
        {
            return await _userRepository.GetUsersAsync(queryDto, cancellationToken);
        }

        public async Task<bool> UpdateUserRoleAsync(int id, string role, CancellationToken cancellationToken = default)
        {
            return await _userRepository.UpdateUserRoleAsync(id, role, cancellationToken);
        }

        public async Task<bool> DisableUserAsync(int id, CancellationToken cancellationToken = default)
        {
            return await _userRepository.DisableUserAsync(id, cancellationToken);
        }
    }
}
