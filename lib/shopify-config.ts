/**
 * Shopify API Configuration
 *
 * Initialises the `@shopify/shopify-api` client using type-safe environment
 * variables from `lib/env.ts`. The configured `shopify` object is exported
 * for use by Admin API clients, webhook handlers, and other Shopify-facing code.
 *
 * The client is configured for **offline** access tokens (default for embedded
 * apps) so that background tasks (webhooks, analytics) can operate without a
 * user session.
 */

import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";
import { env } from "./env";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the host name (no scheme, no path) and scheme from the `HOST` env
 * var, which is expected to be a full URL (e.g. `https://my-app.netlify.app`).
 */
function parseHost(
  hostUrl: string,
): { hostName: string; hostScheme: "http" | "https" } {
  const url = new URL(hostUrl);
  return {
    hostName: url.hostname,
    hostScheme: url.protocol.replace(":", "") as "http" | "https",
  };
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

const { hostName, hostScheme } = parseHost(env.HOST);

export const shopify = shopifyApi({
  apiKey: env.SHOPIFY_API_KEY,
  apiSecretKey: env.SHOPIFY_API_SECRET,
  scopes: env.SHOPIFY_SCOPES.split(",").map((s) => s.trim()),
  hostName,
  hostScheme,
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: true,
});
