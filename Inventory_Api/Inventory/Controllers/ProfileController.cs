using Inventory.DTOs;
using Inventory.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Inventory.Controllers;

/// <summary>
/// Represents a controller for managing user profiles.
/// </summary>
[ApiController]
[Route("api/v1/profile")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public class ProfileController : ControllerBase
{

    /// <summary>
    /// Gets the profile information of the authenticated user.
    /// </summary>
    /// <returns>The user id, email and role read from the access token.</returns>
    [Authorize]
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<ProfileResponseDto> GetProfile()
    {
        // The JWT bearer handler maps the "sub" and "email" claims of the token to ClaimTypes.NameIdentifier and ClaimTypes.Email.
        return Ok(new ProfileResponseDto
        {
            UserId = User.GetUserId()?.ToString(),
            Email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email),
            Role = User.FindFirstValue(ClaimTypes.Role)
        });
    }

    /// <summary>
    /// Deletes the profile of the user with the specified ID. This action is restricted to users with the "Admin" role.
    /// </summary>
    /// <param name="id">The user identifier.</param>
    /// <returns>No content.</returns>
    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public IActionResult DeleteProfile(int id)
    {
        return NoContent();
    }
}

