# Inventory API

A lightweight RESTful API for managing products and inventory.

The backend is built with ASP.NET Core and .NET 10, using Entity Framework Core, SQL Server, JWT authentication, in-memory caching, and health checks. The project also includes a React and TypeScript frontend designed as a single-page application.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Docker](#docker)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Errors](#errors)
- [Health Checks and Swagger](#health-checks-and-swagger)
- [Testing and CI/CD](#testing-and-cicd)
- [Logging and Diagnostics](#logging-and-diagnostics)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License and Contact](#license-and-contact)

## Features

### Product Management

- Create products
- Update products
- Delete products
- View product details
- Browse products with pagination
- Search products (name, price range, category, low stock), with sorting
- Low stock alerts, with a threshold per product

### Inventory

- Categories and warehouses
- Stock movements (in, out, adjustment) recorded in a SQL transaction with the stock update, never letting the stock go negative
- Movement history per product, per warehouse and per period
- Dashboard: product count, stock value, low stock products, latest movements (cached 60 seconds, refreshed by every movement)

### Authentication and Authorization

- Admin login and logout
- JWT bearer authentication
- Role-based authorization
- Password hashing with Microsoft Identity

### Performance and Reliability

- In-memory caching for database calls
- Liveness and readiness health checks
- Optimistic concurrency (SQL Server rowversion), returned as 409 Conflict
- Rate limiting of the authentication endpoints
- Structured JSON logs (Serilog) and Application Insights
- Transactions and error handling for SQL Server
- Server-side and client-side validation
- Error logging with `ILogger`

## Architecture

### Backend Architecture

The backend follows a layered architecture based on separation of concerns.

- **Controllers** handle HTTP requests and return HTTP responses.
- **Services** contain business logic and application rules.
- **Repositories** abstract data access and interact with Entity Framework Core.
- **Entity Framework Core** provides database access through `AppDbContext`.

The dependency flow is:
Controller → Service → Repository → Database

### Frontend Architecture

The React frontend follows a separation-of-concerns architecture organized by technical responsibility.

- **Components** Reusable UI components
- **Pages** Route-level application views
- **Hooks** Reusable stateful logic
- **Services** API communication
- **Context** Shared application state

## Technology Stack

### Backend

- .NET 10
- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- Microsoft Identity password hashing
- JWT Bearer authentication
- IMemoryCache
- OpenAPI and Swagger
- ILogger
- Serilog (compact JSON to the console)
- Azure Monitor OpenTelemetry (Application Insights)

### Frontend

- React
- TypeScript

## Infrastructure and Deployment

- Docker
- Docker Compose
- Azure Container Apps
- Azure SQL Database
- Azure Key Vault
- GitHub Actions
- CodeQL
- SonarCloud
- dotnet format

## Testing

- xUnit
- Unit tests for database calls
- Unit tests involving cancellation tokens
- API tests
- Automated test execution through GitHub Actions

## Requirements

- .NET 10 SDK
- SQL Server, either locally or remotely
- Entity Framework Core CLI tools
- Docker, if running the application in containers
- Visual Studio 2026 or another compatible IDE

## Getting Started

1. Clone the Repository
git clone https://github.com/OlivierT11/Inventory.git
cd Inventory

3. Configure the Application
Update appsettings.json or configure the required environment variables.

Required settings include:
- ConnectionStrings:DefaultConnection
- Jwt:Key
- Jwt:Issuer
- Jwt:Audience
- Cors:AllowedOrigins

3. Restore and Build the Project
dotnet restore
dotnet build

4. Apply Entity Framework Core Migrations
dotnet ef database update

5. Run the API
dotnet run --project Inventory_Api/Inventory

When using Visual Studio, open Inventory.slnx and run the API project.

## Docker

When running in Docker, use the Docker environment:
ASPNETCORE\_ENVIRONMENT=Docker
DOTNET\_RUNNING\_IN\_CONTAINER=true

Database migrations are applied automatically when the application runs in the Docker environment.

Make sure that the required database connection string, JWT settings, and exposed ports are configured correctly.

## Configuration

Example appsettings.json configuration:

{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=InventoryDb;Trusted\_Connection=True;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "your-very-long-secret-key",
    "Issuer": "InventoryApi",
    "Audience": "InventoryClients"
  },
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:3000"
    ]
  },
  "RateLimiting": {
    "Auth": {
      "PermitLimit": 10,
      "WindowSeconds": 60
    }
  }
}

In Development, CORS allows the React dev server (http://localhost:5173) and the Angular dev server (http://localhost:4200).

Optional environment variable:
- APPLICATIONINSIGHTS_CONNECTION_STRING: when set, requests, SQL dependencies, exceptions and logs are sent to Application Insights. When it is not set, Application Insights is disabled.

Do not commit production secrets, JWT keys, database passwords, or other sensitive values to the repository. Use environment variables or Azure Key Vault for production configuration.

## Authentication

The API uses JWT bearer tokens.
Include the token in authenticated requests:
Authorization: Bearer <token>
Authentication-related components include:
- JwtTokenService
- IAuthService
- IAuthRepository

## API Endpoints

All the endpoints are versioned under `/api/v1/`. Unless stated otherwise they require a token; "User" means any authenticated user (roles Admin and User).

| Method | Route | Access | Description |
|---|---|---|---|
| POST | /api/v1/auth/login | anonymous | Get an access token and a refresh token |
| POST | /api/v1/auth/refresh | anonymous | Exchange a refresh token for a new pair |
| POST | /api/v1/auth/register | anonymous | Create a user |
| POST | /api/v1/auth/logout | User | Revoke the access and refresh tokens |
| GET | /api/v1/profile | User | Current user (id, email, role) |
| GET | /api/v1/products | User | All products |
| GET | /api/v1/products/paged | User | Search: `name`, `minPrice`, `maxPrice`, `lowStockOnly`, `categoryId`, `sortBy`, `sortDirection`, `askedPage`, `pageSize` |
| GET | /api/v1/products/low-stock | User | Products at or below their threshold |
| GET | /api/v1/products/{id} | User | One product |
| GET | /api/v1/products/{id}/movements | User | Movement history of a product (paginated) |
| POST, PUT, DELETE | /api/v1/products[/{id}] | Admin | Manage products (a product with movements cannot be deleted) |
| GET | /api/v1/categories[/{id}] | User | Categories |
| POST, PUT, DELETE | /api/v1/categories[/{id}] | Admin | Manage categories (a category with products cannot be deleted) |
| GET | /api/v1/warehouses[/{id}] | User | Warehouses |
| POST, PUT, DELETE | /api/v1/warehouses[/{id}] | Admin | Manage warehouses (a warehouse with movements cannot be deleted) |
| POST | /api/v1/stock/movements | User | Record a movement: `type` is `In`, `Out` or `Adjustment` |
| GET | /api/v1/stock/movements | User | Movements filtered by `warehouseId` and period (`from` inclusive, `to` exclusive, UTC) |
| GET | /api/v1/dashboard | User | Product count, stock value, low stock products, latest movements |

The authentication endpoints are rate limited per client IP (10 requests per minute by default, see `RateLimiting:Auth`).

See the OpenAPI document for request models and response formats.

## Errors

Every error is returned as a ProblemDetails (`application/problem+json`):

| Status | When |
|---|---|
| 400 | Invalid request; unknown `productId`, `warehouseId` or `categoryId` (reported in `errors` like a validation error) |
| 401 / 403 | Missing or invalid token / insufficient role |
| 404 | Unknown resource or route |
| 409 | Concurrent modification (reload and retry), or deletion of a category, warehouse or product still in use |
| 422 | Business rule: the movement would make the stock negative |
| 429 | Too many authentication requests (see the `Retry-After` header) |
| 500 | Unexpected error |

## Health Checks and Swagger

Health checks (no token required):
GET /health/live    the process is running
GET /health/ready   the database is reachable

OpenAPI documentation is enabled in the Development environment:
/openapi/v1.json

It declares the bearer scheme, the response types and the enums as strings, so it can be used to generate the Angular client, for example:
npx ng-openapi-gen --input http://localhost:5293/openapi/v1.json --output src/app/api

Swagger UI is available at /swagger when:
ASPNETCORE\_ENVIRONMENT=Development

## Testing and CI/CD

Run the test suite with:
dotnet test

The GitHub Actions pipeline includes:
- Building the application
- Running xUnit tests
- Running API tests
- Running Docker Compose
- Code quality checks with dotnet format
- Code scanning with CodeQL
- Static analysis with SonarCloud
- Building Docker images
- Deploying to Azure

## Logging and Diagnostics

Serilog writes structured logs to the console, one JSON object per line, plus one summary line per request
(health probes are only logged when they fail). Azure Container Apps collects them as is in Log Analytics.

Log levels are set in the `Serilog` section of appsettings.json.

When `APPLICATIONINSIGHTS_CONNECTION_STRING` is set, the same logs, the requests, the SQL dependencies and the exceptions are also sent to Application Insights.

## Deployment

The application can be deployed to Azure using:
- Azure Container Apps
- Azure SQL Database
- Azure Key Vault

## Deployed Applications

Frontend:
https://inventory-frontend-container-app.gentledune-2e10108a.francecentral.azurecontainerapps.io

## Business Rules

The business rules are documented progressively as the application evolves.

- Only administrators can manage products, categories and warehouses; every authenticated user can read them and record stock movements.
- A movement and its stock change are saved together or not at all (one SQL transaction).
- The stock can never become negative: such a movement is refused (422).
- In and Out quantities are positive; an Adjustment quantity is signed and non-zero.
- The movement date and author are set by the server (UTC date, user of the token).
- Categories, warehouses and products that are referenced (by products or movements) cannot be deleted (409).
- A product is in low stock when its stock is at or below its `LowStockThreshold` (10 by default).

## Contributing

- Fork the repository.
- Create a feature branch:
    git switch -c feature/my-feature
- Implement your changes.
- Add or update tests.
- Run the test suite:
    dotnet test
- Commit and push your changes.
- Open a pull request with a clear description.

## License and Contact

See the repository for license details.

Repository:
https://github.com/OlivierT11/Inventory
