using Inventory.DTOs;

namespace Inventory.Repositories.Interfaces;

/// <summary>
/// Database calls for the dashboard.
/// </summary>
public interface IDashboardRepository
{
    /// <summary>
    /// Gets the dashboard figures, from the cache when they are less than 60 seconds old.
    /// </summary>
    Task<DashboardDto> GetAsync(CancellationToken cancellationToken = default);
}