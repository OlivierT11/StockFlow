using Inventory.DTOs;

namespace Inventory.Services.Interfaces;

/// <summary>
/// Dashboard business logic. Calls the repository.
/// </summary>
public interface IDashboardService
{
    /// <summary>Gets the dashboard figures (up to 60 seconds old).</summary>
    Task<DashboardDto> GetAsync(CancellationToken cancellationToken = default);
}
