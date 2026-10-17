namespace Inventory.Utils;

/// <summary>
/// IMemoryCache keys shared by the repositories, so that the one that writes evicts exactly what the one that reads cached.
/// </summary>
public static class CacheKeys
{
    /// <summary>
    /// The dashboard (cached 60 s, evicted by every stock movement and product write).
    /// </summary>
    public const string Dashboard = "dashboard";

    /// <summary>
    /// A product read by id (cached 5 min, evicted by its updates, deletion and stock movements).
    /// </summary>
    /// <param name="id">The product identifier.</param>
    /// <returns>The cache key.</returns>
    public static string Product(int id) => $"product:{id}";
}
