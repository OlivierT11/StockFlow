using Inventory.Data;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

var allowedOrigins =
    builder.Configuration
        .GetSection("Cors:AllowedOrigins") // appsettings.env.json
        .Get<string[]>() ?? [];

// database service
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        // add retry options for transient failures (e.g., network issues, database failover).
        // useful for cloud-hosted databases (e.g., Azure SQL Database).
        sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorNumbersToAdd: null);
        }));

// Only set the container URL when running in Docker
var inContainer = Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true";
if (inContainer)
{
    builder.WebHost.UseUrls("http://0.0.0.0:8080");
}

// jwt authentication service
var jwtSettings = builder.Configuration.GetSection("Jwt");
var signingKey = jwtSettings["Key"]
    ?? throw new InvalidOperationException("JWT key is missing.");

// Configure JWT authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Configure the token validation parameters for JWT authentication
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(signingKey)),

            ValidateIssuer = true,
            ValidIssuer = jwtSettings["Issuer"],

            ValidateAudience = true,
            ValidAudience = jwtSettings["Audience"],

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        // Add an event handler to check for revoked tokens during token validation
        // Necessary because JWT tokens are stateless and cannot be invalidated on the server side without additional logic.
        options.Events = new JwtBearerEvents
        {
            // This event is triggered when a token is successfully validated.
            OnTokenValidated = context =>
            {
                // Get the TokenRevocationService from the request services to check if the token has been revoked.
                var revocationService =
                    context.HttpContext.RequestServices
                        .GetRequiredService<TokenRevocationService>();

                // Extract the unique identifier (jti) claim from the validated token.
                var jti = context.Principal?
                    .FindFirst(JwtRegisteredClaimNames.Jti)
                    ?.Value;

                if (!string.IsNullOrWhiteSpace(jti) &&
                    revocationService.IsRevoked(jti))
                {
                    context.Fail("This token has been revoked.");
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(); //jwt
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// basic health checks
builder.Services
    .AddHealthChecks()
    // app health check (Liveness)
    .AddCheck(
        "self",
        () => HealthCheckResult.Healthy(),
        tags: ["live"])
    // database health check (Readiness)
    .AddDbContextCheck<AppDbContext>(
        name: "database",
        tags: ["ready"]);


// CORS (for frontend calls or direct API calls)
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
    {
        // connect from anywhere (allows API testing in prod)
        if (allowedOrigins.Contains("*"))
        {
            policy
                .AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
        // connect from frontend only
        else
        {
            policy
                .WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    });
});

builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddSingleton<TokenRevocationService>(); // singleton service for revoking JWT tokens. This must be a singleton so that the revoked tokens are shared across all requests and users.
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// IMemoryCache service for caching
builder.Services.AddMemoryCache();

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Add ProblemDetails middleware for centralized error handling and standardized error responses
builder.Services.AddProblemDetails();

var app = builder.Build();

// Apply Entity Framework Core database migrations automatically in the "Docker" environment.
// This ensures that the database schema is up-to-date when the application starts in a containerized environment.
if (app.Environment.IsEnvironment("Docker"))
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Database.Migrate();
    }
}

// Configure the HTTP request pipeline.
// Enable OpenAPI (Swagger) in development environment
if (app.Environment.IsDevelopment())
{
    // Adds an HTTP route that serves the OpenAPI specification document (JSON) for the API.
    app.MapOpenApi();

    // enable swagger ui
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Inventory API v1");
    });
}

// Use HTTPS redirection in development and production, but not in container (Docker) environment
// Avoid forcing HTTPS when running in container (prevents broken redirects)
if (!inContainer)
{
    // Adds an ASP.NET middleware that redirects HTTP requests to HTTPS.
    app.UseHttpsRedirection();
}

// Authorizes the React frontend to call the API (CORS), for example with fetch().
app.UseCors("ReactApp");

app.UseAuthentication(); //jwt
app.UseAuthorization();

// Custom error handling endpoint for centralized exception handling (ProblemDetails). Rather than logging technical errors in every controller.
app.UseExceptionHandler("/error");
app.UseStatusCodePages(); 
app.Map("/error", () =>
    Results.Problem(
        statusCode: StatusCodes.Status500InternalServerError, // An unhandled error will always return a 500.
        title: "Une erreur interne est survenue."));

// health checks
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

// Connects the controllers using thir defined routes (e.g., ProductController.cs defines /api/products route)
app.MapControllers();

app.Run();
