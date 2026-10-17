using Inventory.DTOs;
using Inventory.Services;
using Inventory.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.IdentityModel.Tokens.Jwt;

namespace Inventory.Controllers
{
    /// <summary>
    /// Represents a controller for handling authentication-related operations, such as user login and token generation.
    /// </summary>
    [ApiController]
    [Route("api/v1/auth")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _service;
        private readonly TokenRevocationService _tokenRevocationService;

        /// <summary>
        /// Initializes a new instance of the <see cref="AuthController"/> class.
        /// </summary>
        /// <param name="service">The authentication service.</param>
        /// <param name="tokenRevocationService">The service that revokes the access tokens on logout.</param>
        public AuthController(IAuthService service, TokenRevocationService tokenRevocationService = default)
        {
            _service = service;
            _tokenRevocationService = tokenRevocationService;
        }

        /// <summary>
        /// Handles user login requests. Validates the provided email and password, and generates a JWT token if the credentials are valid.
        /// </summary>
        /// <param name="dto">The user credentials.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>The access token and the refresh token.</returns>
        [HttpPost("login")] //(url)/api/v1/auth/login
        [ProducesResponseType<LoginResponseDto>(StatusCodes.Status200OK)]
        [ProducesResponseType<MessageResponseDto>(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> Login(LoginDto dto, CancellationToken cancellationToken = default)
        {
            string[] tokens = await _service.LogUserAsync(dto, cancellationToken);

            if (tokens is null)
            {
                return Unauthorized(new MessageResponseDto  // Unauthorized() is part of IActionResult, as well as OK()
                {
                    Message = "Invalid email or password."
                });
            }

            return Ok(new LoginResponseDto { AccessToken = tokens[0], RefreshToken = tokens[1] });
        }

        /// <summary>
        /// Endpoint POST /api/auth/refresh.
        /// Refreshes the access token using a valid refresh token. 
        /// If the provided refresh token is valid and not revoked or expired, a new access token and refresh token are generated and returned. 
        /// The old refresh token is revoked to prevent reuse.
        /// </summary>
        /// <param name="request">The refresh token.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>A new access token and a new refresh token.</returns>
        [HttpPost("refresh")]
        [ProducesResponseType<TokenResponseDto>(StatusCodes.Status200OK)]
        [ProducesResponseType<MessageResponseDto>(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> Refresh(RefreshRequest request, CancellationToken cancellationToken = default)
        {
            // RefreshRequest has no validation attribute: without this check, a blank token reaches the service,
            // whose ArgumentException ends as a 500 on /error.
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                ModelState.AddModelError(nameof(request.RefreshToken), "The refresh token is required.");
                return ValidationProblem(ModelState);
            }

            string[] tokens = await _service.RefreshTokenAsync(request, cancellationToken);

            if (tokens is null)
            {
                return Unauthorized(new MessageResponseDto
                {
                    Message = "Invalid or expired refresh token."
                });
            }

            return Ok(new TokenResponseDto
            {
                AccessToken = tokens[0],
                RefreshToken = tokens[1]
            });
        }

        /// <summary>
        /// Handles user logout requests. Revokes the JWT token provided in the Authorization header, preventing further use of that token for authentication.
        /// </summary>
        /// <param name="request">The refresh token to revoke along with the access token.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>No content.</returns>
        [Authorize]
        [HttpPost("logout")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> Logout(
            RefreshRequest request,
            CancellationToken cancellationToken = default)
        {
            if (request is null || string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return BadRequest("Missing refresh token.");
            }

            // Extract the JWT token from the Authorization header
            var token = Request.Headers.Authorization
                .ToString()
                .Replace("Bearer ", "", StringComparison.OrdinalIgnoreCase);

            if (string.IsNullOrWhiteSpace(token))
            {
                return BadRequest("Missing access token.");
            }

            var handler = new JwtSecurityTokenHandler();
            var jwtToken = handler.ReadJwtToken(token);

            // Extract the jti (JWT ID) claim from the token, which is used to uniquely identify the token for revocation purposes.
            var jti = jwtToken.Claims
                .FirstOrDefault(claim => claim.Type == JwtRegisteredClaimNames.Jti)
            ?.Value;

            if (string.IsNullOrWhiteSpace(jti))
            {
                return BadRequest("Token does not contain a jti claim.");
            }

            await _service.RevokeRefreshTokenAsync(request.RefreshToken, cancellationToken);

            _tokenRevocationService.Revoke(
                jti,
                jwtToken.ValidTo
            );

            return NoContent();
        }


        /// <summary>
        /// Handles user registration requests. Creates a new user with the provided email, password, and role. Returns a success message if the user is created successfully, or an error message if there was an issue during the creation process.
        /// </summary>
        /// <param name="request">The user registration details.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>A confirmation message.</returns>
        [HttpPost("register")] //(url)/api/v1/auth/register
        [ProducesResponseType<MessageResponseDto>(StatusCodes.Status200OK)]
        [ProducesResponseType<MessageResponseDto>(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> AddUser(CreateUserDTO request, CancellationToken cancellationToken = default)
        {
            var isAdded = await _service.AddUserAsync(request, cancellationToken);

            if (!isAdded)
            {
                return BadRequest(new MessageResponseDto
                {
                    Message = "This user already exists."
                });
            }

            return Ok(new MessageResponseDto
            {
                Message = "User created successfully."
            });
        }
    }
}
