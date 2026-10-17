using Inventory.Controllers;
using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Inventory.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;

namespace Tests;

public class AuthTests
{
    /// <summary>
    /// Test to ensure that the Login method returns an OkObjectResult with a token when valid credentials are provided.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Login_ReturnsOk_WithToken_WhenCredentialsValid()
    {
        // Arrange
        var expectedToken = "fake-jwt-token";
        var mockService = new Mock<IAuthService>();
        mockService
            .Setup(s => s.LogUserAsync(It.IsAny<LoginDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([expectedToken, "fake-refresh-token"]);

        var controller = new AuthController(mockService.Object);
        var dto = new LoginDto { Email = "user@example.com", Password = "Password123!" };

        // Act
        var actionResult = await controller.Login(dto, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var tokens = Assert.IsType<LoginResponseDto>(okResult.Value);
        Assert.Equal(expectedToken, tokens.AccessToken);
    }

    /// <summary>
    /// Test to ensure that the Login method returns an UnauthorizedObjectResult when invalid credentials are provided.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Login_ReturnsUnauthorized_WhenCredentialsInvalid()
    {
        // Arrange
        var mockService = new Mock<IAuthService>();
        mockService
            .Setup(s => s.LogUserAsync(
                It.IsAny<LoginDto>(), // "It" is a Moq helper class used to describe argument matching
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((string[]?)null);

        var controller = new AuthController(mockService.Object);
        var dto = new LoginDto { Email = "user@example.com", Password = "wrong" };

        // Act
        var actionResult = await controller.Login(dto, CancellationToken.None);

        // Assert
        Assert.IsType<UnauthorizedObjectResult>(actionResult);
    }

    /// <summary>
    /// Refresh token rotation.
    /// Tests the endpoint api/auth/refresh.
    /// Test to ensure that the Refresh method returns an OkObjectResult with a new token pair when a valid refresh token is provided.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Refresh_ReturnsOk_WithTokenPair_WhenRefreshTokenIsValid()
    {
        var existingRefreshToken = "existing-refresh-token";
        var userEmail = "refresh-user@example.com";

        using var factory = new InMemoryWebApplicationFactory();

        // Arrange: create a user and a refresh token in the database
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = new User
            {
                Username = "refresh-user",
                PasswordHash = "unused",
                Email = userEmail
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();

            context.RefreshTokens.Add(new RefreshToken
            {
                TokenHash = Cryptography.HashToken(existingRefreshToken),
                UserId = user.Id,
                ExpiresAtUtc = DateTime.UtcNow.AddDays(1)
            });
            await context.SaveChangesAsync();
        }

        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/refresh",
            new RefreshRequest { RefreshToken = existingRefreshToken });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Assert that the response contains a new access token and refresh token
        var tokenResponse = await response.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = tokenResponse.GetProperty("accessToken").GetString();
        var newRefreshToken = tokenResponse.GetProperty("refreshToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        Assert.False(string.IsNullOrWhiteSpace(newRefreshToken));
        Assert.NotEqual(existingRefreshToken, newRefreshToken);
    }

    /// <summary>
    /// Test an invalid refresh token.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Refresh_ReturnsUnauthorized_WhenRefreshTokenIsRevoked()
    {
        const string revokedRefreshToken = "revoked-refresh-token";

        // Arrange : prépare les données dans la base de l'application.
        using var factory = new InMemoryWebApplicationFactory();

        // Create a scope to access the database context
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            var user = new User
            {
                Username = "refresh-user",
                PasswordHash = "unused",
                Email = "refresh-user@example.com"
            };

            context.Users.Add(user);
            await context.SaveChangesAsync();

            context.RefreshTokens.Add(new RefreshToken
            {
                TokenHash = Cryptography.HashToken(revokedRefreshToken),
                UserId = user.Id,
                ExpiresAtUtc = DateTime.UtcNow.AddDays(1),
                RevokedAtUtc = DateTime.UtcNow.AddMinutes(-1)
            });

            await context.SaveChangesAsync();
        }

        using var client = factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/refresh",
            new RefreshRequest { RefreshToken = revokedRefreshToken });

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// Test to ensure that the AddUser method returns an OkObjectResult with a success message when the service successfully adds a user.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task AddUser_ReturnsOk_WhenUserIsAdded()
    {
        // Arrange
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();

        var request = new CreateUserDTO
        {
            Email = "new@example.com",
            Password = "Pass123!"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Read the response body as JSON and check for the success message
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(body.TryGetProperty("message", out var message));
        Assert.Contains(
            "User created",
            message.GetString(),
            StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Test to ensure that the AddUser method returns a BadRequestObjectResult when the service fails to add a user.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task AddUser_ReturnsBadRequest_WhenServiceFailsToAddUser()
    {
        // Arrange
        var mockService = new Mock<IAuthService>();
        mockService
            .Setup(s => s.AddUserAsync(It.IsAny<CreateUserDTO>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var controller = new AuthController(mockService.Object);
        var request = new CreateUserDTO { Email = "new@example.com", Password = "Pass123!" };

        // Act
        var actionResult = await controller.AddUser(request, CancellationToken.None);

        // Assert
        Assert.IsType<BadRequestObjectResult>(actionResult);
    }

    /// <summary>
    /// Test to ensure that the profile endpoint returns the user id and email of the token.
    /// The JWT bearer handler renames the "sub" and "email" claims, so reading them under their JWT names returned null.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task Profile_ReturnsUserOfToken()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (client, userId) = await factory.CreateAuthenticatedClientAsync("User");

        var profile = await client.GetFromJsonAsync<ProfileResponseDto>("/api/v1/profile");

        Assert.Equal(userId.ToString(), profile!.UserId);
        Assert.EndsWith("@example.com", profile.Email);
        Assert.Equal("User", profile.Role);
    }

    /// <summary>
    /// Test to ensure that the /error endpoint returns a 500 Internal Server Error response with ProblemDetails.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task ErrorEndpoint_Returns500ProblemDetails()
    {
        // Arrange
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/error");

        // Assert
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();

        Assert.NotNull(problem);
        Assert.Equal(500, problem.Status);
        Assert.Equal("Une erreur interne est survenue.", problem.Title);
    }

    /// <summary>
    /// Test to ensure that an unknown route returns a 404 Not Found response with ProblemDetails. 
    /// Program.cs is configured to return ProblemDetails for unknown routes, and this test verifies that behavior.
    /// Program.cs won't use the default 404 page, but instead will return a ProblemDetails object with status 404.
    /// app.UseExceptionHandler("/error"); won't be used here because the request is not an exception, but a 404 Not Found.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task UnknownRoute_Returns404ProblemDetails()
    {
        // Arrange
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/route-inconnue-pour-le-test");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();

        Assert.NotNull(problem);
        Assert.Equal(404, problem.Status);
    }

    // ---------------------------------------------------------------------
    // API tests: register, login, refresh and logout with the real AuthService, AuthRepository and JWT validation
    // ---------------------------------------------------------------------

    private const string ValidPassword = "Pass123!";

    /// <summary>
    /// Registers a user through the API, logs in and returns the token pair.
    /// </summary>
    private static async Task<LoginResponseDto> RegisterAndLoginAsync(HttpClient client, string email)
    {
        var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { email, password = ValidPassword });
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = ValidPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        return (await login.Content.ReadFromJsonAsync<LoginResponseDto>())!;
    }

    /// <summary>
    /// Sends a request with the given access token.
    /// </summary>
    private static async Task<HttpResponseMessage> SendWithTokenAsync(
        HttpClient client,
        HttpMethod method,
        string url,
        string accessToken,
        object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request);
    }

    /// <summary>
    /// Test to ensure that a registered user can log in, and that the tokens returned work:
    /// the access token opens the protected endpoints, the refresh token gives a new pair.
    /// </summary>
    [Fact]
    public async Task Api_RegisterThenLogin_ReturnsTokensThatWork()
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();

        var tokens = await RegisterAndLoginAsync(client, "alice@example.com");

        var profile = await SendWithTokenAsync(client, HttpMethod.Get, "/api/v1/profile", tokens.AccessToken);
        Assert.Equal(HttpStatusCode.OK, profile.StatusCode);
        var user = await profile.Content.ReadFromJsonAsync<ProfileResponseDto>();
        Assert.Equal("alice@example.com", user!.Email);
        Assert.Equal("User", user.Role); // the role given at registration

        var refresh = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest { RefreshToken = tokens.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
    }

    /// <summary>
    /// Test to ensure that a wrong password and an unknown email get the same 401,
    /// so that the response does not tell which emails are registered.
    /// </summary>
    [Fact]
    public async Task Api_Login_WithWrongPasswordOrUnknownEmail_ReturnsSameUnauthorized()
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();
        await RegisterAndLoginAsync(client, "alice@example.com");

        var wrongPassword = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "alice@example.com", password = "Wrong123!" });
        var unknownEmail = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "bob@example.com", password = ValidPassword });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal(await wrongPassword.Content.ReadAsStringAsync(), await unknownEmail.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// Test to ensure that an email can only be registered once, and that the second registration does not change the account.
    /// </summary>
    [Fact]
    public async Task Api_Register_WithExistingEmail_ReturnsBadRequest()
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();
        await RegisterAndLoginAsync(client, "alice@example.com");

        var again = await client.PostAsJsonAsync("/api/v1/auth/register", new { email = "alice@example.com", password = "Other123!" });

        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "alice@example.com", password = ValidPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    /// <summary>
    /// Test to ensure the rotation of the refresh tokens: a refresh token can only be used once, the new one replaces it.
    /// A stolen refresh token that was already used is therefore worthless.
    /// </summary>
    [Fact]
    public async Task Api_Refresh_RefreshTokenCanOnlyBeUsedOnce()
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();
        var tokens = await RegisterAndLoginAsync(client, "alice@example.com");

        var first = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest { RefreshToken = tokens.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var rotated = (await first.Content.ReadFromJsonAsync<TokenResponseDto>())!;

        var reused = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest { RefreshToken = tokens.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);

        var next = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest { RefreshToken = rotated.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, next.StatusCode);
    }

    /// <summary>
    /// Test to ensure that a blank refresh token is a client error (400), not a server error.
    /// </summary>
    [Fact]
    public async Task Api_Refresh_WithBlankToken_ReturnsBadRequest()
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = " " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>
    /// Test to ensure that logout revokes both tokens. The access token has not expired, so only the revocation list
    /// (checked in OnTokenValidated, Program.cs) can stop it: it must be rejected on the very next request.
    /// </summary>
    [Fact]
    public async Task Api_Logout_RevokesAccessTokenAndRefreshToken()
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();
        var tokens = await RegisterAndLoginAsync(client, "alice@example.com");
        Assert.Equal(HttpStatusCode.OK,
            (await SendWithTokenAsync(client, HttpMethod.Get, "/api/v1/profile", tokens.AccessToken)).StatusCode);

        var logout = await SendWithTokenAsync(client, HttpMethod.Post, "/api/v1/auth/logout", tokens.AccessToken,
            new RefreshRequest { RefreshToken = tokens.RefreshToken });
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await SendWithTokenAsync(client, HttpMethod.Get, "/api/v1/profile", tokens.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest { RefreshToken = tokens.RefreshToken })).StatusCode);
    }

    /// <summary>
    /// Test to ensure that a logout without refresh token is refused and revokes nothing: the access token still works.
    /// </summary>
    [Fact]
    public async Task Api_Logout_WithoutRefreshToken_ReturnsBadRequestAndKeepsAccessToken()
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var client = factory.CreateClient();
        var tokens = await RegisterAndLoginAsync(client, "alice@example.com");

        var logout = await SendWithTokenAsync(client, HttpMethod.Post, "/api/v1/auth/logout", tokens.AccessToken,
            new { refreshToken = "" });

        Assert.Equal(HttpStatusCode.BadRequest, logout.StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await SendWithTokenAsync(client, HttpMethod.Get, "/api/v1/profile", tokens.AccessToken)).StatusCode);
    }

    // ---------------------------------------------------------------------
    // Controller and service tests
    // ---------------------------------------------------------------------

    /// <summary>
    /// Test to ensure that logout is refused when the access token cannot be revoked: no Authorization header,
    /// or a token without jti claim. Nothing is revoked then, not even the refresh token.
    /// </summary>
    [Fact]
    public async Task Logout_ReturnsBadRequest_WhenAccessTokenIsMissingOrHasNoJti()
    {
        var service = new Mock<IAuthService>();
        var controller = new AuthController(service.Object, new TokenRevocationService())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var request = new RefreshRequest { RefreshToken = "refresh-token" };

        Assert.IsType<BadRequestObjectResult>(await controller.Logout(request));

        var tokenWithoutJti = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            claims: [new Claim(JwtRegisteredClaimNames.Sub, "1")],
            expires: DateTime.UtcNow.AddMinutes(5)));
        controller.HttpContext.Request.Headers.Authorization = $"Bearer {tokenWithoutJti}";

        Assert.IsType<BadRequestObjectResult>(await controller.Logout(request));

        service.Verify(s => s.RevokeRefreshTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// Test to ensure that the service rejects blank credentials and tokens without calling the repository.
    /// The DTO validation already rejects them in the API: this is the safety net for the other callers.
    /// </summary>
    [Fact]
    public async Task Service_RejectsBlankCredentialsAndTokens_WithoutCallingRepository()
    {
        var repository = new Mock<IAuthRepository>(MockBehavior.Strict); // any call fails the test
        var service = new AuthService(
            new JwtTokenService(new ConfigurationBuilder().Build()),
            repository.Object,
            new MemoryCache(new MemoryCacheOptions()),
            new PasswordHasher<User>());

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.LogUserAsync(new LoginDto { Email = "alice@example.com", Password = " " }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.LogUserAsync(new LoginDto { Email = " ", Password = ValidPassword }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.AddUserAsync(new CreateUserDTO { Email = "alice@example.com", Password = " " }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.AddUserAsync(new CreateUserDTO { Email = " ", Password = ValidPassword }));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RefreshTokenAsync(new RefreshRequest { RefreshToken = " " }));
        Assert.False(await service.RevokeRefreshTokenAsync(" "));
    }

    /// <summary>
    /// Test to ensure that a revoked access token stays rejected until it expires, and that the entry is dropped afterwards
    /// (an expired token is rejected by the JWT validation anyway).
    /// </summary>
    [Fact]
    public void TokenRevocation_RejectsTokenUntilItExpires()
    {
        var revocations = new TokenRevocationService();

        Assert.False(revocations.IsRevoked("never-revoked"));

        revocations.Revoke("active", DateTime.UtcNow.AddMinutes(5));
        Assert.True(revocations.IsRevoked("active"));
        Assert.True(revocations.IsRevoked("active")); // still rejected on the next request

        revocations.Revoke("expired", DateTime.UtcNow.AddSeconds(-1));
        Assert.False(revocations.IsRevoked("expired"));
    }

    // ---------------------------------------------------------------------
    // Repository tests
    // ---------------------------------------------------------------------

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static AuthRepository CreateRepository(
        AppDbContext context,
        ILogger<ProductRepository>? logger = null,
        TimeSpan? timeout = null) =>
        new(context, logger ?? NullLogger<ProductRepository>.Instance, timeout);

    private static async Task<User> AddUserAsync(AppDbContext context)
    {
        var user = new User { Username = "alice", Email = "alice@example.com", PasswordHash = "unused" };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    /// <summary>
    /// Test to ensure that a refresh token is refused when it is unknown, expired, or belongs to a user that no longer exists,
    /// and that a refused token is neither revoked nor replaced.
    /// </summary>
    [Fact]
    public async Task Repository_RefreshTokenAsync_RefusesUnknownExpiredAndOrphanTokens()
    {
        await using var context = CreateContext();
        var user = await AddUserAsync(context);
        context.RefreshTokens.AddRange(
            new RefreshToken { TokenHash = Cryptography.HashToken("expired"), UserId = user.Id, ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1) },
            new RefreshToken { TokenHash = Cryptography.HashToken("orphan"), UserId = 999, ExpiresAtUtc = DateTime.UtcNow.AddDays(1) });
        await context.SaveChangesAsync();
        var repo = CreateRepository(context);

        Assert.Null(await repo.RefreshTokenAsync(new RefreshRequest { RefreshToken = "unknown" }));
        Assert.Null(await repo.RefreshTokenAsync(new RefreshRequest { RefreshToken = "expired" }));
        Assert.Null(await repo.RefreshTokenAsync(new RefreshRequest { RefreshToken = "orphan" }));

        var stored = await context.RefreshTokens.ToListAsync();
        Assert.Equal(2, stored.Count);
        Assert.All(stored, token => Assert.Null(token.RevokedAtUtc));
    }

    /// <summary>
    /// Test to ensure that only the hash of an issued refresh token is stored, and that the token can be revoked once,
    /// after which it no longer refreshes.
    /// </summary>
    [Fact]
    public async Task Repository_RevokeRefreshTokenAsync_RevokesIssuedTokenOnce()
    {
        await using var context = CreateContext();
        var user = await AddUserAsync(context);
        var repo = CreateRepository(context);

        var token = await repo.IssueRefreshTokenAsync(user);

        Assert.False(await context.RefreshTokens.AnyAsync(t => t.TokenHash == token));
        Assert.True(await repo.RevokeRefreshTokenAsync(token));
        Assert.False(await repo.RevokeRefreshTokenAsync(token)); // already revoked
        Assert.False(await repo.RevokeRefreshTokenAsync("unknown"));
        Assert.Null(await repo.RefreshTokenAsync(new RefreshRequest { RefreshToken = token }));
    }

    /// <summary>
    /// Test to ensure that the methods on the repository template rethrow a cancellation, and log it as information
    /// when the caller canceled, as a warning when the timeout expired.
    /// </summary>
    [Fact]
    public async Task Repository_Methods_WhenCallerCancelsOrTimesOut_LogAndThrow()
    {
        await using var context = CreateContext();
        var newUser = new User { Username = "alice", Email = "alice@example.com", PasswordHash = "unused" };

        var callerLogger = new ListLogger<ProductRepository>();
        var repo = CreateRepository(context, callerLogger);
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.LogUserAsync(newUser, cts.Token));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => repo.AddUserAsync(newUser, cts.Token));
        Assert.Equal(2, callerLogger.Entries.Count);
        Assert.All(callerLogger.Entries, entry => Assert.Equal(LogLevel.Information, entry.Level));

        var timeoutLogger = new ListLogger<ProductRepository>();
        var timedOutRepo = CreateRepository(context, timeoutLogger, TimeoutAssert.Expired);

        await TimeoutAssert.ThrowsAndLogsTimeoutAsync(timeoutLogger, () => timedOutRepo.LogUserAsync(newUser));
        await TimeoutAssert.ThrowsAndLogsTimeoutAsync(timeoutLogger, () => timedOutRepo.AddUserAsync(newUser));
    }
}
