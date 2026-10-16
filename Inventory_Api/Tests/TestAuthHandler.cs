using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Tests
{
    // This class is a custom authentication handler for testing purposes. It simulates an authenticated user with a specific role.
    public sealed class TestAuthHandler
        : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string Scheme = "IntegrationTestAuth";

        public TestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        // This method handles the authentication process for the test user.
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            // Create claims for a test user with the "Admin" role.
            var claims = new[]
            {
                new Claim(ClaimTypes.Name, "Test admin"),
                new Claim(ClaimTypes.Role, "Admin")
            };

            // Create a ClaimsIdentity and ClaimsPrincipal for the test user.
            var identity = new ClaimsIdentity(claims, Scheme);
            var principal = new ClaimsPrincipal(identity);

            // Create an AuthenticationTicket for the test user.
            var ticket = new AuthenticationTicket(principal, Scheme);

            // Return a successful authentication result with the test user's ticket.
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
