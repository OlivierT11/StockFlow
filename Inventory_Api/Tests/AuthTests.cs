using Inventory.Controllers;
using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Services;
using Inventory.Utils;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using System.Net;
using System.Net.Http.Json;
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

}
