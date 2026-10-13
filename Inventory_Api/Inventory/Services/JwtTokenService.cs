using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Inventory.Services
{
    /// <summary>
    /// Represents a service for creating JWT tokens.
    /// </summary>
    public sealed class JwtTokenService
    {
        private readonly IConfiguration _configuration;

        /// <summary>
        /// Initializes a new instance of the <see cref="JwtTokenService"/> class.
        /// </summary>
        /// <param name="configuration">The configuration.</param>
        public JwtTokenService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>
        /// Creates a JWT token for the specified user.
        /// </summary>
        /// <param name="userId">The user ID.</param>
        /// <param name="email">The user's email address.</param>
        /// <param name="role">The user's role.</param>
        /// <returns>The JWT token.</returns>
        /// <exception cref="InvalidOperationException">Thrown when the JWT key is missing.</exception>
        public string CreateToken(int userId, string email, string role)
        {
            // Get the JWT configuration section from the appsettings.json file
            var jwt = _configuration.GetSection("Jwt");
            var key = jwt["Key"]
                ?? throw new InvalidOperationException("JWT key is missing.");

            // Create claims for the token, including a unique identifier, user ID, email, and role
            var claims = new[]
            {
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), // unique identifier for the token, used to revoke the token on logout
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()), // used to identify the user
            new Claim(JwtRegisteredClaimNames.Email, email), // used to identify the user
            new Claim(ClaimTypes.Role, role) // used to identify the user's role
        };

            // Create signing credentials using the JWT key and HMAC SHA256 algorithm
            var credentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256);

            // Create the JWT token with the specified issuer, audience, claims, expiration time, and signing credentials
            var token = new JwtSecurityToken(
                issuer: jwt["Issuer"],
                audience: jwt["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(
                    double.Parse(jwt["ExpiresMinutes"] ?? "15")), // default to 15 minutes if not specified in appsettings.json. Use double.Parse to convert the string from appsettings.json to a double.
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
