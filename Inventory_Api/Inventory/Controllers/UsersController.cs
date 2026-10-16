using Inventory.DTOs;
using Inventory.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Inventory.Controllers
{
    /// <summary>
    /// Represents a controller for managing users.
    /// </summary>
    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _service;

        public UsersController(IUserService service)
        {
            _service = service;
        }

        [Authorize(Roles = "Admin")]
        [HttpGet]
        public async Task<IActionResult> GetUsers([FromQuery] UserSearchQueryDto dto, CancellationToken cancellationToken = default)
        {
            UserListResponseDto response = await _service.GetUsersAsync(dto, cancellationToken);

            if (response.Users.Count == 0)
            {
                return NotFound(new { message = "No users found." });
            }

            return Ok(new { 
                message = "Users found.", 
                users = response.Users 
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/role")]
        public async Task<IActionResult> UpdateUserRole([FromRoute] int id, [FromBody] UserRoleUpdateDto request, CancellationToken cancellationToken = default)
        {
            var role = request.Role;

            if (id <= 0 || id > int.MaxValue)
            {
                return BadRequest(new { message = "Invalid user ID." });
            }

            bool updated = await _service.UpdateUserRoleAsync(id, role, cancellationToken);

            if (!updated)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(new { message = "User role updated successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/disable")]
        public async Task<IActionResult> DisableUser([FromRoute] int id, CancellationToken cancellationToken = default)
        {
            if (id <= 0 || id > int.MaxValue)
            {
                return BadRequest(new { message = "Invalid user ID." });
            }

            bool disabled = await _service.DisableUserAsync(id, cancellationToken);

            if (!disabled)
            {
                return NotFound(new { message = "User not found or already disabled." });
            }

            return Ok(new { message = "User disabled successfully." });
        }
    }
}
