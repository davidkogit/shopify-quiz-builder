/**
 * Shared Shopify Webhook Utilities
 *
 * Common helpers used across webhook route handlers.
 */
import crypto from "node:crypto";

/**
 * Verify a Shopify webhook HMAC-SHA256 signature.
 *
 * The signature is sent in the `x-shopify-hmac-sha256` header and is
 * computed as `base64(HMAC-SHA256(raw_body, api_secret))`.
 *
 * Uses constant-time comparison via `crypto.timingSafeEqual` to prevent
 * timing attacks — consistent with the OAuth callback pattern.
 */
export function verifyWebhookHmac(
  rawBody: string,
  hmacHeader: string,
  secret: string,
): boolean {
  const generated = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(generated, "utf8"),
    Buffer.from(hmacHeader, "utf8"),
  );
}
