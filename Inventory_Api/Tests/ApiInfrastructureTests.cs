using Inventory.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Tests;

/// <summary>
/// Tests of what the whole API provides: health checks, rate limiting, versioning, OpenAPI document, CORS.
/// </summary>
public class ApiInfrastructureTests
{
    /// <summary>
    /// Test to ensure that the liveness and readiness probes of Container Apps answer 200 without a token.
    /// </summary>
    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")] // checks the database too
    public async Task HealthChecks_ReturnHealthy(string path)
    {
        using var factory = new InMemoryWebApplicationFactory();

        var response = await factory.CreateClient().GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// Test to ensure that /api/v1/auth/* is rate limited, with a 429 ProblemDetails and a Retry-After header,
    /// and that the other endpoints are not.
    /// </summary>
    [Fact]
    public async Task AuthEndpoints_AreRateLimited()
    {
        using var factory = new InMemoryWebApplicationFactory(new Dictionary<string, string?>
        {
            ["RateLimiting:Auth:PermitLimit"] = "2",
            ["RateLimiting:Auth:WindowSeconds"] = "60"
        });
        using var client = factory.CreateClient();
        var credentials = new { email = "nobody@example.com", password = "wrong-password" };

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/login", credentials)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/login", credentials)).StatusCode);

        // The window is shared by all the auth endpoints of a client.
        var limited = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = "x" });

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.True(limited.Headers.Contains("Retry-After"));
        var problem = await limited.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(429, problem!.Status);

        // Not rate limited: still 401 (no token) rather than 429.
        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/products")).StatusCode);
        }
    }

    /// <summary>
    /// Test to ensure that the unversioned routes no longer exist.
    /// </summary>
    [Fact]
    public async Task UnversionedRoutes_ReturnNotFound()
    {
        using var factory = new InMemoryWebApplicationFactory();
        var (client, _) = await factory.CreateAuthenticatedClientAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/products")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/products")).StatusCode);
    }

    /// <summary>
    /// Test to ensure that /openapi/v1.json describes everything the Angular client generator needs:
    /// every versioned endpoint, the query parameters of the searches, the response types, the string enums
    /// and the bearer scheme on the protected endpoints.
    /// </summary>
    [Fact]
    public async Task OpenApiDocument_IsCompleteForClientGeneration()
    {
        using var factory = new InMemoryWebApplicationFactory(); // Development environment: the document is mapped
        var document = await factory.CreateClient().GetFromJsonAsync<JsonElement>("/openapi/v1.json");

        var paths = document.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();

        Assert.All(paths, path => Assert.StartsWith("/api/v1/", path));
        Assert.Superset(
            new HashSet<string>
            {
                "/api/v1/auth/login",
                "/api/v1/auth/refresh",
                "/api/v1/profile",
                "/api/v1/products",
                "/api/v1/products/{id}",
                "/api/v1/products/paged",
                "/api/v1/products/low-stock",
                "/api/v1/products/{productId}/movements",
                "/api/v1/categories",
                "/api/v1/categories/{id}",
                "/api/v1/warehouses",
                "/api/v1/warehouses/{id}",
                "/api/v1/stock/movements",
                "/api/v1/dashboard"
            },
            paths.ToHashSet());

        // The search is described as query parameters, not as a GET body.
        var search = document.GetProperty("paths").GetProperty("/api/v1/products/paged").GetProperty("get");
        Assert.False(search.TryGetProperty("requestBody", out _));
        var parameters = search.GetProperty("parameters").EnumerateArray()
            .Select(p => p.GetProperty("name").GetString())
            .ToList();
        Assert.Contains("CategoryId", parameters);
        Assert.Contains("LowStockOnly", parameters);

        // Typed responses (the generator creates a model for each one).
        var schemas = document.GetProperty("components").GetProperty("schemas");
        foreach (var schema in new[] { "LoginResponseDto", "DashboardDto", "StockMovementListDto", "CategoryResponseDto", "ProblemDetails" })
        {
            Assert.True(schemas.TryGetProperty(schema, out _), $"Schema {schema} is missing.");
        }

        // Enums as strings, as the API sends them.
        var movementType = schemas.GetProperty("StockMovementType");
        Assert.Equal(["In", "Out", "Adjustment"], movementType.GetProperty("enum").EnumerateArray().Select(v => v.GetString()));

        // Bearer scheme declared, and required by the protected endpoints only.
        var bearer = document.GetProperty("components").GetProperty("securitySchemes").GetProperty("Bearer");
        Assert.Equal("bearer", bearer.GetProperty("scheme").GetString());

        var dashboard = document.GetProperty("paths").GetProperty("/api/v1/dashboard").GetProperty("get");
        Assert.True(dashboard.GetProperty("security")[0].TryGetProperty("Bearer", out _));
        var login = document.GetProperty("paths").GetProperty("/api/v1/auth/login").GetProperty("post");
        Assert.False(login.TryGetProperty("security", out _));

        // XML comments are included (descriptions for the generated client).
        Assert.False(string.IsNullOrWhiteSpace(dashboard.GetProperty("summary").GetString()));
    }

    /// <summary>
    /// Test to ensure that an unexpected exception, which ApiExceptionHandler leaves alone (it only handles the business
    /// and concurrency exceptions), ends on the /error endpoint: a 500 ProblemDetails that does not reveal the exception message.
    /// </summary>
    [Fact]
    public async Task UnexpectedException_Returns500ProblemDetailsWithoutExceptionMessage()
    {
        var service = new Mock<IDashboardService>();
        service
            .Setup(s => s.GetAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Server=prod-sql;Password=secret"));

        using var baseFactory = new InMemoryWebApplicationFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddScoped(_ => service.Object)));
        var (client, _) = await factory.CreateAuthenticatedClientAsync();

        var response = await client.GetAsync("/api/v1/dashboard");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("secret", body);
        var problem = JsonSerializer.Deserialize<ProblemDetails>(body, JsonSerializerOptions.Web);
        Assert.Equal("Une erreur interne est survenue.", problem!.Title);
    }

    /// <summary>
    /// Test to ensure that the future Angular front (ng serve on port 4200) is allowed by CORS in Development.
    /// </summary>
    [Theory]
    [InlineData("http://localhost:4200")]
    [InlineData("http://localhost:5173")]
    public async Task Cors_AllowsLocalFrontsInDevelopment(string origin)
    {
        using var factory = new InMemoryWebApplicationFactory();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/products");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "authorization");

        var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }
}
