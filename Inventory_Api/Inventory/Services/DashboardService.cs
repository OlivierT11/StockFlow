using Inventory.DTOs;
using Inventory.Repositories;
using Inventory.Repositories.Interfaces;
using Inventory.Services.Interfaces;

namespace Inventory.Services
{
    /// <summary>
    /// Dashboard business logic. Calls the repository, which caches the figures for 60 seconds.
    /// </summary>
    public class DashboardService : IDashboardService
    {
        private readonly IDashboardRepository _dashboardRepository;

        /// <summary>
        /// Initializes a new instance of the <see cref="DashboardService"/> class.
        /// </summary>
        /// <param name="dashboardRepository">The dashboard repository.</param>
        public DashboardService(IDashboardRepository dashboardRepository)
        {
            _dashboardRepository = dashboardRepository;
        }

        /// <inheritdoc />
        public Task<DashboardDto> GetAsync(CancellationToken cancellationToken = default)
        {
            return _dashboardRepository.GetAsync(cancellationToken);
        }
    }
}
