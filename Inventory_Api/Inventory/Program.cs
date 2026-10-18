using Azure.Monitor.OpenTelemetry.AspNetCore;
using Inventory.Data;
using Inventory.Exceptions;
using Inventory.Models;
using Inventory.Repositories;
using Inventory.Services;
using Inventory.Utils;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

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

// Enums are sent and received as strings ("In", "Out", "Adjustment") rather than numbers.
// Set on both option types: MVC uses the first, the OpenAPI document generator the second.
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// OpenAPI document (/openapi/v1.json), used to generate the Angular client.
// Declares the JWT bearer scheme and marks the endpoints that require it, so the generated client sends the token.
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "Access token returned by POST /api/v1/auth/login."
        };

        return Task.CompletedTask;
    });

    options.AddOperationTransformer((operation, context, cancellationToken) =>
    {
        var metadata = context.Description.ActionDescriptor.EndpointMetadata;

        if (metadata.OfType<IAuthorizeData>().Any() && !metadata.OfType<IAllowAnonymous>().Any())
        {
            operation.Security ??= [];
            operation.Security.Add(new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", context.Document)] = []
            });
        }

        return Task.CompletedTask;
    });
});

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
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IWarehouseService, WarehouseService>();
builder.Services.AddScoped<IWarehouseRepository, WarehouseRepository>();
builder.Services.AddScoped<IStockMovementService, StockMovementService>();
builder.Services.AddScoped<IStockMovementRepository, StockMovementRepository>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddSingleton<TokenRevocationService>(); // singleton service for revoking JWT tokens. This must be a singleton so that the revoked tokens are shared across all requests and users.
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// IMemoryCache service for caching
builder.Services.AddMemoryCache();

// Logging: Serilog writes structured logs to the console, one JSON object per line (compact JSON format),
// which Azure Container Apps collects as is: each property can then be queried in Log Analytics.
// Levels are set in the "Serilog" section of appsettings.json.
builder.Logging.ClearProviders();

// Application Insights, enabled only when APPLICATIONINSIGHTS_CONNECTION_STRING is set (Container App environment variable / secret).
// Sends the requests, the SQL dependencies, the exceptions and the logs to Azure Monitor.
if (!string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
{
    builder.Services.AddOpenTelemetry().UseAzureMonitor();
}

builder.Services.AddSerilog(
    (services, loggerConfiguration) => loggerConfiguration
        .ReadFrom.Configuration(builder.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console(new RenderedCompactJsonFormatter()),
    // Also passes the events to the other logging providers (the Application Insights one, when enabled).
    writeToProviders: true);

// Add ProblemDetails middleware for centralized error handling and standardized error responses
builder.Services.AddProblemDetails();

// Turns the business exceptions of the services (and the concurrency conflicts) into 400 / 409 / 422 ProblemDetails.
// Any other exception still goes to the /error endpoint (500).
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

// Rate limiting of /api/v1/auth/* (see [EnableRateLimiting] on AuthController): a fixed window per client IP.
// The limits are read at request time, so tests and environments can change them through configuration.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(RateLimitPolicies.Auth, httpContext =>
    {
        var limits = httpContext.RequestServices
            .GetRequiredService<IConfiguration>()
            .GetSection("RateLimiting:Auth");

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limits.GetValue("PermitLimit", 10),
                Window = TimeSpan.FromSeconds(limits.GetValue("WindowSeconds", 60)),
                QueueLimit = 0
            });
    });

    // Same error format as the rest of the API.
    options.OnRejected = async (context, cancellationToken) =>
    {
        var response = context.HttpContext.Response;
        response.StatusCode = StatusCodes.Status429TooManyRequests;

        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        }

        await context.HttpContext.RequestServices
            .GetRequiredService<IProblemDetailsService>()
            .WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context.HttpContext,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Trop de requêtes.",
                    Detail = "Trop de tentatives d'authentification. Réessayez dans quelques instants."
                }
            });
    };
});

// Behind the Azure Container Apps ingress, the TCP connection comes from the ingress, not from the client:
// read the client IP (used by the rate limiter and the logs) and scheme from the X-Forwarded-* headers it adds.
// The ingress addresses are not known in advance, so every proxy is trusted; ForwardLimit stays at 1, so only the
// last address of X-Forwarded-For is used (the one appended by the ingress, which the client cannot forge).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// Only in a container (Azure Container Apps): without a proxy in front, X-Forwarded-For would come from the client itself.
if (inContainer)
{
    app.UseForwardedHeaders();
}

// One structured log line per request (method, path, status, duration) instead of the many lines of ASP.NET Core.
// The health probes of Container Apps hit /health every few seconds: they are only logged when they fail.
app.UseSerilogRequestLogging(options =>
{
    options.GetLevel = (httpContext, elapsed, exception) =>
    {
        if (exception is not null || httpContext.Response.StatusCode >= 500)
        {
            return LogEventLevel.Error;
        }

        return httpContext.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose : LogEventLevel.Information;
    };

});

// Apply Entity Framework Core database migrations automatically in the "Docker" environment.
// This ensures that the database schema is up-to-date when the application starts in a containerized environment.
if (app.Environment.IsEnvironment("Docker"))
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
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

// After UseCors, so that the 429 responses carry the CORS headers and the browser lets the client read them.
app.UseRateLimiter();

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

// Connects the controllers using thir defined routes (e.g., ProductsController defines the /api/v1/products route)
app.MapControllers();

await app.RunAsync();
