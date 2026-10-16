using Inventory.Data;
using Inventory.Models;
using Inventory.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Repositories
{
    /// <summary>
    /// Database calls for the categories. Every call is canceled after a timeout (10 s by default) or when the caller cancels.
    /// </summary>
    public class CategoryRepository : ICategoryRepository
    {
        private readonly AppDbContext _context;
        private readonly ILogger<CategoryRepository> _logger;
        private readonly TimeSpan _timeout;

        /// <summary>
        /// Initializes a new instance of the <see cref="CategoryRepository"/> class.
        /// </summary>
        /// <param name="context">The database context.</param>
        /// <param name="logger">The logger.</param>
        /// <param name="timeout">The timeout of each database call (10 s by default).</param>
        public CategoryRepository(
            AppDbContext context,
            ILogger<CategoryRepository> logger,
            TimeSpan? timeout = null)
        {
            _context = context;
            _logger = logger;
            _timeout = timeout ?? TimeSpan.FromSeconds(10);
        }

        /// <inheritdoc />
        public async Task<List<Category>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            // timeout token
            using var timeoutCts = new CancellationTokenSource(_timeout);

            // link the cancellation token with the timeout token
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                return await _context.Categories
                    .AsNoTracking()
                    .OrderBy(category => category.Name)
                    .ToListAsync(linkedCts.Token);
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Get categories was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Get categories timed out");
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<Category?> GetByIdAsync(
            int id,
            CancellationToken cancellationToken = default)
        {
            using var timeoutCts = new CancellationTokenSource(_timeout);

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                return await _context.Categories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(category => category.Id == id, linkedCts.Token);
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Get category was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Get category timed out");
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<bool> ExistsAsync(
            int id,
            CancellationToken cancellationToken = default)
        {
            using var timeoutCts = new CancellationTokenSource(_timeout);

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                return await _context.Categories
                    .AnyAsync(category => category.Id == id, linkedCts.Token);
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Check category existence was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Check category existence timed out");
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<Category> CreateAsync(
            Category category,
            CancellationToken cancellationToken = default)
        {
            using var timeoutCts = new CancellationTokenSource(_timeout);

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                _context.Categories.Add(category);
                await _context.SaveChangesAsync(linkedCts.Token);

                return category;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Create category was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Create category timed out");
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<bool> UpdateAsync(
            int id,
            Category category,
            CancellationToken cancellationToken = default)
        {
            using var timeoutCts = new CancellationTokenSource(_timeout);

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                var stored = await _context.Categories
                    .FirstOrDefaultAsync(c => c.Id == id, linkedCts.Token);

                if (stored is null)
                {
                    return false;
                }

                stored.Name = category.Name;

                try
                {
                    await _context.SaveChangesAsync(linkedCts.Token);
                }
                catch (DbUpdateConcurrencyException)
                {
                    // No concurrency token on this table: the only possible conflict is a row deleted by another request.
                    _context.Entry(stored).State = EntityState.Detached;

                    _logger.LogInformation(
                        "Update category was skipped: the category was deleted by another request");

                    return false;
                }

                return true;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Update category was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Update category timed out");
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<bool> DeleteAsync(
            int id,
            CancellationToken cancellationToken = default)
        {
            using var timeoutCts = new CancellationTokenSource(_timeout);

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                var stored = await _context.Categories
                    .FirstOrDefaultAsync(c => c.Id == id, linkedCts.Token);

                if (stored is null)
                {
                    return false;
                }

                _context.Categories.Remove(stored);

                try
                {
                    await _context.SaveChangesAsync(linkedCts.Token);
                }
                catch (DbUpdateConcurrencyException)
                {
                    // The row was deleted by another request after it was loaded.
                    _context.Entry(stored).State = EntityState.Detached;

                    _logger.LogInformation(
                        "Delete category was skipped: the category was already deleted by another request");

                    return false;
                }

                return true;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Delete category was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Delete category timed out");
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<bool> HasProductsAsync(
            int id,
            CancellationToken cancellationToken = default)
        {
            using var timeoutCts = new CancellationTokenSource(_timeout);

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken,
                timeoutCts.Token);

            try
            {
                return await _context.Products
                    .AnyAsync(x => x.CategoryId == id, linkedCts.Token);
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "Check category products was canceled by the caller");
                throw;
            }
            catch (OperationCanceledException) when (
                timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Check category products timed out");
                throw;
            }
        }
    }
}
