using System.Text.Json.Serialization;

namespace Inventory.DTOs;

// Typed responses of the auth and profile endpoints, so that /openapi/v1.json describes them.
// The JSON property names are the ones the endpoints returned before (anonymous objects), so existing clients keep working.

/// <summary>
/// The tokens returned by POST /api/v1/auth/login.
/// </summary>
public class LoginResponseDto
{
    /// <summary>Gets or sets the JWT access token (15 minutes).</summary>
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>Gets or sets the refresh token (14 days, single use).</summary>
    [JsonPropertyName("refresh_token")]
    public string RefreshToken { get; set; } = string.Empty;
}

/// <summary>
/// The tokens returned by POST /api/v1/auth/refresh.
/// </summary>
public class TokenResponseDto
{
    /// <summary>Gets or sets the new JWT access token.</summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>Gets or sets the new refresh token; the one sent in the request is revoked.</summary>
    public string RefreshToken { get; set; } = string.Empty;
}

/// <summary>
/// A response that only carries a message.
/// </summary>
public class MessageResponseDto
{
    /// <summary>Gets or sets the message.</summary>
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// The authenticated user, as read from the access token (GET /api/v1/profile).
/// </summary>
public class ProfileResponseDto
{
    /// <summary>Gets or sets the user identifier.</summary>
    public string? UserId { get; set; }

    /// <summary>Gets or sets the user email.</summary>
    public string? Email { get; set; }

    /// <summary>Gets or sets the user role (Admin or User).</summary>
    public string? Role { get; set; }
}
