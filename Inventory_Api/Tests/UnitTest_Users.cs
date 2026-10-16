using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Net.Http.Json;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

namespace Tests;

public class UnitTest_Users
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static void AddUser(AppDbContext context, string username, string role, string email)
    {
        context.Users.Add(new User
        {
            Username = username,
            Role = role,
            PasswordHash = "hashedpassword",
            Email = email
        });
    }


    /// <summary>
    /// Get a list of users with filters and pagination, and assert that the response is 200 OK.
    /// </summary>
    /// <returns></returns>
    [Fact]
    public async Task GetUsersAsync_ReturnsUsers()
    {
        // Creates a custom WebApplicationFactory<Program>, which allow the creation of a test DB and custom auth.
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        // Arrange : insérer les données dans la base de l'application de test.
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com");

            await context.SaveChangesAsync();
        }

        var query = new UserSearchQueryDto
        {
            DisplayName = "Alice",
            Role = "admin",
            Page = 1,
            PageSize = 10
        };

        var url = QueryHelpers.AddQueryString(
            "/api/users",
            new Dictionary<string, string?>
            {
                ["displayName"] = query.DisplayName,
                ["role"] = query.Role,
                ["page"] = query.Page.ToString(),
                ["pageSize"] = query.PageSize.ToString()
            });

        var response = await client.GetAsync(url);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var users = await response.Content.ReadFromJsonAsync<UserListResponseDto>();

        Assert.NotNull(users);
        Assert.NotEmpty(users.Users);
    }


    [Fact]
    public async Task GetUsersAsync_WhenNoUsersExist_ReturnsEmptyList()
    {
        // Creates a custom WebApplicationFactory<Program>, which allow the creation of a test DB and custom auth.
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        // Arrange : insérer les données dans la base de l'application de test.
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com");

            await context.SaveChangesAsync();
        }

        var query = new UserSearchQueryDto
        {
            DisplayName = "User_not_existing",
            Role = "admin",
            Page = 1,
            PageSize = 10
        };

        var url = QueryHelpers.AddQueryString(
            "/api/users",
            new Dictionary<string, string?>
            {
                ["displayName"] = query.DisplayName,
                ["role"] = query.Role,
                ["page"] = query.Page.ToString(),
                ["pageSize"] = query.PageSize.ToString()
            });

        var response = await client.GetAsync(url);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var users = await response.Content.ReadFromJsonAsync<UserListResponseDto>();

        Assert.NotNull(users);
        Assert.Empty(users.Users);

    }


    [Fact]
    public async Task GetUsersWithPagerAsync_FilterOnName()
    {
        // Creates a custom WebApplicationFactory<Program>, which allow the creation of a test DB and custom auth.
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        // Arrange : insérer les données dans la base de l'application de test.
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com");

            await context.SaveChangesAsync();
        }

        var query = new UserSearchQueryDto
        {
            DisplayName = "Alice",
            Page = 1,
            PageSize = 10
        };

        var url = QueryHelpers.AddQueryString(
            "/api/users",
            new Dictionary<string, string?>
            {
                ["displayName"] = query.DisplayName,
                ["page"] = query.Page.ToString(),
                ["pageSize"] = query.PageSize.ToString()
            });

        var response = await client.GetAsync(url);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var users = await response.Content.ReadFromJsonAsync<UserListResponseDto>();

        Assert.NotNull(users);
        Assert.NotEmpty(users.Users);
        Assert.Contains(users.Users, u => u.DisplayName == "Alice");
        Assert.Single(users.Users);
    }

    [Fact]
    public async Task GetUsersWithPagerAsync_FilterOnRole()
    {
        // Creates a custom WebApplicationFactory<Program>, which allow the creation of a test DB and custom auth.
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        // Arrange : insérer les données dans la base de l'application de test.
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com");

            await context.SaveChangesAsync();
        }
        var query = new UserSearchQueryDto
        {
            Role = "admin",
            Page = 1,
            PageSize = 10
        };

        var url = QueryHelpers.AddQueryString(
            "/api/users",
            new Dictionary<string, string?>
            {
                ["role"] = query.Role,
                ["page"] = query.Page.ToString(),
                ["pageSize"] = query.PageSize.ToString()
            });

        var response = await client.GetAsync(url);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var users = await response.Content.ReadFromJsonAsync<UserListResponseDto>();

        Assert.NotNull(users);
        Assert.NotEmpty(users.Users);
        Assert.Contains(users.Users, u => u.DisplayName == "Alice");
        Assert.Single(users.Users);
    }



    [Fact]
    public async Task GetUsersWithPagerAsync_WhenExceedPageSize_ReturnsPartialList()
    {
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com");
            AddUser(context, "Alice2", "admin", "alice2@example.com");

            await context.SaveChangesAsync();
        }
        var query = new UserSearchQueryDto
        {
            Role = "admin",
            Page = 1,
            PageSize = 1
        };

        var url = QueryHelpers.AddQueryString(
            "/api/users",
            new Dictionary<string, string?>
            {
                ["role"] = query.Role,
                ["page"] = query.Page.ToString(),
                ["pageSize"] = query.PageSize.ToString()
            });

        var response = await client.GetAsync(url);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var users = await response.Content.ReadFromJsonAsync<UserListResponseDto>();

        Assert.NotNull(users);
        Assert.NotEmpty(users.Users);
        Assert.Contains(users.Users, u => u.DisplayName == "Alice");
        Assert.Single(users.Users); // Only one user should be returned due to the page size limit

    }

    [Fact]
    public async Task UpdateUserRoleAsync_WhenUserExists_ReturnsOK()
    {
        // Arrange
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com");

            await context.SaveChangesAsync();
        }

        // Act 
        // Prepare the content for the PUT request
        var content = JsonContent.Create(new { role = "user" });

        var response = await client.PutAsync("/api/users/1/role", content);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateUserRoleAsync_WhenUserNotExists_ReturnsNotFound()
    {
        // Arrange
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com");

            await context.SaveChangesAsync();
        }

        var content = JsonContent.Create(new { role = "user" });

        // Act 
        var response = await client.PutAsync("/api/users/2/role", content); 

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DisableUserAsync_WhenUserExists_ReturnsOK()
    {
        // Arrange
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com"); //IsActive is true by default

            await context.SaveChangesAsync();
        }

        // Act 
        var response = await client.PutAsync("/api/users/1/disable", content: null); // No content needed for this test (everything is in the URL)

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task DisableUserAsync_WhenUserNotExists_ReturnsNotFound()
    {
        // Arrange
        using var factory = new TestApplicationFactory();
        using var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            AddUser(context, "Alice", "admin", "alice@example.com"); //IsActive is true by default

            await context.SaveChangesAsync();
        }

        // Act 
        var response = await client.PutAsync("/api/users/2/disable", content: null); // No content needed for this test (everything is in the URL)

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}