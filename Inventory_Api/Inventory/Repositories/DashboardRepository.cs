using Inventory.Data;
using Inventory.DTOs;
using Inventory.Repositories.Interfaces;
using Inventory.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Inventory.Repositories
{
    /// <summary>
    /// Computes the dashboard figures. The result is cached for 60 seconds and evicted by every stock movement
    /// and every product write (see <see cref="CacheKeys.Dashboard"/>).
    /// </summary>
    public class DashboardRepository : IDashboardRepository
    {
        /// <summary>
        /// How long the dashboard is served from the cache when nothing changes.
        /// </summary>
        public static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

        private const int ListSize = 10;

        private readonly AppDbContext _context;
        private readonly ILogger<DashboardRepository> _logger;
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _timeout;

        /// <summary>
        /// Initializes a new instance of the <see cref="DashboardRepository"/> class.
        /// </summary>
        /// <param name="context">The database context.</param>
        /// <param name="logger">The logger.</param>
        /// <param name="cache">The cache holding the dashboard.</param>
        /// <param name="timeout">The timeout of the database calls (10 s by default).</param>
        public DashboardRepository(
            AppDbContext context,
            ILogger<DashboardRepository> logger,
            IMemoryCache cache,
            TimeSpan? timeout = null)
        {
            _context = context;
            _logger = logger;
            _cache = cache;
            _timeout = timeout ?? TimeSpan.FromSeconds(10);
        }

        /// <inheritdoc />
        public async Task<DashboardDto> GetAsync(
            CancellationToken cancellationToken = default)
        {
            if (_cache.TryGetValue<DashboardDto>(CacheKeys.Dashboard, out var cached) && cached is not null)
            {
                return cached;
            }

            using var timeoutCts = new CancellationTokenSource(_timeout);

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                var products = _context.Products.AsNoTracking();
                var lowStock = products.Where(p => p.Stock <= p.LowStockThreshold);

                var dashboard = new DashboardDto
                {
                    ProductCount = await products.CountAsync(linkedCts.Token),
                    TotalStockValue = await products.SumAsync(p => p.Price * p.Stock, linkedCts.Token),
                    LowStockProductCount = await lowStock.CountAsync(linkedCts.Token),
                    LowStockProducts = await lowStock
                        .OrderBy(p => p.Stock)
                        .ThenBy(p => p.Name)
                        .Take(ListSize)
                        .Select(ProductProjections.ToResponseDto)
                        .ToListAsync(linkedCts.Token),
                    RecentMovements = await _context.StockMovements
                        .AsNoTracking()
                        .OrderByDescending(m => m.Date)
                        .ThenByDescending(m => m.Id)
                        .Take(ListSize)
                        .Select(StockMovementProjections.ToResponseDto)
                        .ToListAsync(linkedCts.Token),
                    GeneratedAtUtc = DateTime.UtcNow
                };

                // A movement committed while the queries above were running evicts the key before this Set:
                // the dashboard can then be up to CacheDuration old, as with any cached value.
                _cache.Set(CacheKeys.Dashboard, dashboard, CacheDuration);

                return dashboard;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Get dashboard was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Get dashboard timed out");
                throw;
            }
        }
    }
}
