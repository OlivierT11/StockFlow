using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Inventory.Utils;

/// <summary>
/// Helpers to read the claims of the authenticated user.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Gets the user id stored in the "sub" claim of the JWT.
    /// The JWT bearer handler maps "sub" to <see cref="ClaimTypes.NameIdentifier"/> by default, so both names are checked.
    /// </summary>
    /// <param name="user">The authenticated user.</param>
    /// <returns>The user id, or null if the claim is missing or is not a number.</returns>
    public static int? GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(value, out var userId) ? userId : null;
    }
}
