using Inventory.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Tests;

/// <summary>
/// WebApplicationFactory configured for integration tests that replaces the application's AppDbContext with an
/// in-memory database and configures test authentication with an Admin role.
/// </summary>
public sealed class TestApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = Guid.NewGuid().ToString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Configure the test services to use an in-memory database and set up test authentication.
        builder.ConfigureTestServices(services =>
        {
            // Remove the existing AppDbContext registration to replace it with an in-memory database.
            services.RemoveAll<DbContextOptions<AppDbContext>>();

            // Remove any existing IDbContextOptionsConfiguration registrations to avoid conflicts with the in-memory database configuration.
            foreach (var descriptor in services
                .Where(descriptor => descriptor.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration", StringComparison.Ordinal))
                .ToList())
            {
                services.Remove(descriptor);
            }

            // Add the AppDbContext with an in-memory database for testing purposes.
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(databaseName: _databaseName));

            // Configure a temp authentication to use the TestAuthHandler for integration tests.
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.Scheme;
                options.DefaultChallengeScheme = TestAuthHandler.Scheme;
                options.DefaultScheme = TestAuthHandler.Scheme;
            })
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                TestAuthHandler.Scheme,
            _ => { });

        });
    }
}