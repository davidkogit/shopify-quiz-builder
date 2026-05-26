/**
 * Type-safe Environment Variable Access
 *
 * Provides a single point of access for all required environment variables.
 * Each accessor **lazily validates** that the variable is set at runtime,
 * throwing a descriptive error if it is missing.
 *
 * The getter pattern (rather than reading once at import time) ensures that
 * variables loaded after module initialisation (e.g. via `dotenv` in
 * non-Next.js contexts) are still picked up correctly.
 */

/**
 * Retrieve a required environment variable, throwing if it is not set.
 *
 * **Pure** w.r.t. `process.env` — the same key always returns the same
 * value during a single process lifetime.
 *
 * @param key - The environment variable name.
 * @returns The string value.
 * @throws If the variable is absent or empty.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Set it in .env or your deployment configuration.`,
    );
  }
  return value;
}

/**
 * Centralised, type-safe environment configuration.
 *
 * Usage:
 * ```ts
 * import { env } from "@/../lib/env";
 * const key = env.SHOPIFY_API_KEY; // throws if not set
 * ```
 */
export const env = {
  /** Shopify app API key from the Partners dashboard. */
  get SHOPIFY_API_KEY(): string {
    return requireEnv("SHOPIFY_API_KEY");
  },

  /** Shopify app API secret from the Partners dashboard. */
  get SHOPIFY_API_SECRET(): string {
    return requireEnv("SHOPIFY_API_SECRET");
  },

  /** Space-separated OAuth scopes requested during install. */
  get SHOPIFY_SCOPES(): string {
    return requireEnv("SHOPIFY_SCOPES");
  },

  /** 256-bit (32+ character) secret for AES session encryption. */
  get SESSION_SECRET(): string {
    return requireEnv("SESSION_SECRET");
  },

  /** Database connection string (Prisma format). */
  get DATABASE_URL(): string {
    return requireEnv("DATABASE_URL");
  },

  /** Public URL of the app (used for OAuth redirects). Always starts with https:// */
  get HOST(): string {
    const raw = requireEnv("HOST");
    if (!/^https?:\/\//.test(raw)) return `https://${raw}`;
    return raw;
  },

  /**
   * Email API endpoint for sending quiz result emails (e.g. Resend, SendGrid).
   * Optional — email sending is silently skipped when not configured.
   */
  get EMAIL_API_URL(): string | undefined {
    return process.env.EMAIL_API_URL || undefined;
  },

  /**
   * API key for the email service provider.
   * Required only when EMAIL_API_URL is set.
   */
  get EMAIL_API_KEY(): string | undefined {
    return process.env.EMAIL_API_KEY || undefined;
  },
} as const;
