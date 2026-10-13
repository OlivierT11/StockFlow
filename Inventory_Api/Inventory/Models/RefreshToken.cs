namespace Inventory.Models
{
    /// <summary>
    /// Represents a refresh token used for authentication and authorization in the application.
    /// </summary>
    public class RefreshToken
    {
        /// <summary>
        /// Gets or sets the unique identifier for the refresh token.
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Gets or sets the hashed value of the refresh token.
        /// </summary>
        public string TokenHash { get; set; } = "";

        /// <summary>
        /// Gets or sets the unique identifier of the user associated with the refresh token.
        /// </summary>
        public int UserId { get; set; }

        /// <summary>
        /// Gets or sets the UTC date and time when the refresh token expires.
        /// </summary>
        public DateTime ExpiresAtUtc { get; set; }

        /// <summary>
        /// Gets or sets the UTC date and time when the refresh token was revoked, if applicable.
        /// </summary>
        public DateTime? RevokedAtUtc { get; set; }
    }
}
