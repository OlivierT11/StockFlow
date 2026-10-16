namespace Inventory.Utils;

/// <summary>
/// Names of the rate limiting policies registered in Program.cs.
/// </summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Fixed window per client IP on /api/v1/auth/* (login brute force, account creation spam).
    /// Limits are read from the RateLimiting:Auth section of the configuration.
    /// </summary>
    public const string Auth = "auth";
}
