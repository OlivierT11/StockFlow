using Inventory.Data;
using Inventory.Models;
using Inventory.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Net.Http.Headers;

namespace Tests;

/// <summary>
/// Starts the whole API in memory, like WebApplicationFactory, but replaces SQL Server with an EF Core in-memory database.
/// Without this, the API uses the Development connection string (LocalDB), which only exists on Windows,
/// so the tests fail on macOS/Linux and in CI. Each factory gets its own empty database.
/// </summary>
/// <param name="settings">Configuration values that override appsettings.json (e.g. the rate limits).</param>
internal sealed class InMemoryWebApplicationFactory(
    IReadOnlyDictionary<string, string?>? settings = null) : WebApplicationFactory<Program>
{
    private readonly string _databaseName = Guid.NewGuid().ToString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        if (settings is not null)
        {
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(settings));
        }

        builder.ConfigureServices(services =>
        {
            // Remove the SQL Server registration made in Program.cs,
            // otherwise EF Core throws because two database providers are registered.
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();

            // The in-memory provider has no transactions: by default it throws when one is opened (stock movements do).
            // Ignoring the warning lets the endpoints run; the rollback itself is tested on SQLite (StockMovementTests).
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName)
                    .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        });
    }
}

/// <summary>
/// Helpers for the tests that call the API through a factory.
/// </summary>
internal static class WebApplicationFactoryExtensions
{
    /// <summary>
    /// Adds data to the database of the factory.
    /// </summary>
    public static async Task SeedAsync(
        this WebApplicationFactory<Program> factory,
        Action<AppDbContext> seed)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        seed(context);
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Adds a user with the given role to the database and returns a client that sends a valid access token for this user.
    /// </summary>
    public static async Task<(HttpClient Client, int UserId)> CreateAuthenticatedClientAsync(
        this WebApplicationFactory<Program> factory,
        string role = "Admin")
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = new User
        {
            Username = $"{role.ToLowerInvariant()}-user",
            Email = $"{Guid.NewGuid():N}@example.com",
            PasswordHash = "unused",
            Role = role
        };

        context.Users.Add(user);
        await context.SaveChangesAsync();

        var token = scope.ServiceProvider
            .GetRequiredService<JwtTokenService>()
            .CreateToken(user.Id, user.Email, user.Role);

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        return (client, user.Id);
    }
}
