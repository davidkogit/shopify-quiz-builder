/**
 * Shopify Admin API Client
 *
 * Provides REST and GraphQL clients for the Shopify Admin API (2024-10).
 * All functions accept a {@link Session} as an explicit dependency —
 * no global state, no hidden auth lookups.
 *
 * Features:
 * - Automatic Authorization header from session access token
 * - Rate limit handling: respects Retry-After header, exponential backoff on 429
 * - Typed errors: REAUTH (401), SCOPE (403), RETRYABLE (5xx)
 * - Pure-ish: all dependencies injected, inputs never mutated
 *
 * Uses Next.js's built-in extended `fetch` — no extra HTTP library required.
 */

import type { Session } from "./session";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Target Shopify Admin API version. */
const API_VERSION = "2024-10";

/** Maximum number of automatic retries for transient failures. */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff (doubles each retry). */
const BASE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Typed error thrown for non-2xx Shopify API responses.
 *
 * The `code` property classifies the error so callers can decide whether
 * to re-authenticate, request additional scopes, or retry.
 */
export class ShopifyApiError extends Error {
  /** HTTP status code returned by the API. */
  status: number;

  /** Seconds to wait before retrying (from Retry-After header), or null. */
  retryAfter: number | null;

  /** Machine-readable error category. */
  code: "REAUTH" | "SCOPE" | "RETRYABLE" | "UNKNOWN";

  constructor(message: string, status: number, retryAfter: string | null) {
    super(message);
    this.name = "ShopifyApiError";
    this.status = status;
    this.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null;
    this.code = classifyErrorCode(status);
  }
}

/** Map an HTTP status to a typed error category. */
function classifyErrorCode(status: number): ShopifyApiError["code"] {
  if (status === 401) return "REAUTH";
  if (status === 403) return "SCOPE";
  if (status >= 500) return "RETRYABLE";
  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/** Options bag for {@link shopifyRest}. */
export interface ShopifyRestOptions {
  /** HTTP method (defaults to "GET"). */
  method?: string;
  /** JSON-serialisable request body. */
  body?: unknown;
}

/** A Shopify product as returned by the REST Admin API. */
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  status: string;
  images: { src: string; alt?: string }[];
  variants: ShopifyVariant[];
  created_at: string;
  updated_at: string;
}

/** A single product variant. */
export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
}

/** A Shopify custom collection. */
export interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  published_at: string;
}

/** A registered Shopify webhook. */
export interface ShopifyWebhook {
  id: number;
  address: string;
  topic: string;
  format: string;
  created_at: string;
}

/** Wrapper shape returned by the Shopify GraphQL Admin API. */
export interface ShopifyGraphQLResponse<T> {
  data: T | null;
  errors?: { message: string; locations?: unknown[] }[];
}

// ---------------------------------------------------------------------------
// Internal helpers (pure with respect to their arguments)
// ---------------------------------------------------------------------------

/**
 * Build the full REST URL for a given shop and path.
 *
 * @param shopDomain - The `.myshopify.com` domain (with or without protocol).
 * @param path       - API path after the version (e.g. `"products.json"`).
 */
function buildRestUrl(shopDomain: string, path: string): string {
  const domain = shopDomain.replace(/^https?:\/\//, "");
  return `https://${domain}/admin/api/${API_VERSION}/${path}`;
}

/**
 * Build the standard request headers for a Shopify Admin API call.
 *
 * @param accessToken - The store's access token from the session.
 */
function buildHeaders(accessToken: string): HeadersInit {
  return {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Extract the Retry-After value from a response, or null.
 */
function getRetryAfter(res: Response): string | null {
  return res.headers.get("Retry-After");
}

/**
 * Parse a fetch response, throwing a typed error on non-2xx statuses.
 *
 * @returns The parsed JSON body.
 * @throws {ShopifyApiError} When the response status is not OK.
 */
async function parseResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return res.json() as Promise<T>;
  }

  let message = `Shopify API ${res.status}`;
  try {
    const body = await res.json();
    message = body?.errors ?? body?.error ?? message;
  } catch {
    // Body is not JSON — use the status text.
  }

  throw new ShopifyApiError(
    String(message),
    res.status,
    getRetryAfter(res),
  );
}

/**
 * Determine the delay (ms) before the next retry.
 *
 * Respects the Retry-After header if present; otherwise uses exponential
 * backoff: `BASE_DELAY_MS * 2^attempt`.
 */
function backoffDelay(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    return parseInt(retryAfter, 10) * 1000;
  }
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Determine whether a response is retryable.
 *
 * Retry on 429 (rate limit) and 5xx (server errors). Do NOT retry on
 * 401/403 — those require human intervention (re-auth / scope change).
 */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Core fetch wrapper with retry logic for transient failures.
 *
 * Retries only on 429 and 5xx responses. Respects `Retry-After` headers.
 * Uses exponential backoff when no Retry-After header is provided.
 *
 * @param url     - Full URL to fetch.
 * @param options - Fetch options (headers, method, body).
 * @param retries - Number of remaining retries (internal use).
 * @returns The successful Response object.
 * @throws {ShopifyApiError} On non-retryable errors or when retries exhausted.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);

    if (res.ok || !isRetryable(res.status)) {
      return res;
    }

    // If we've exhausted retries, return the last response (will throw via parseResponse).
    if (attempt === retries) {
      return res;
    }

    const delay = backoffDelay(attempt, getRetryAfter(res));
    await new Promise((r) => setTimeout(r, delay));
  }

  // Unreachable — kept for type safety.
  throw new ShopifyApiError("Retries exhausted", 500, null);
}

// ---------------------------------------------------------------------------
// Public API — REST client
// ---------------------------------------------------------------------------

/**
 * Perform a typed REST call against the Shopify Admin API.
 *
 * Automatically attaches the Authorization header from the session's
 * access token. Handles rate limiting with exponential backoff.
 *
 * @param session - The current Shopify session (contains domain + token).
 * @param path    - API path after the version (e.g. `"products.json?limit=50"`).
 * @param options - Optional method and JSON body.
 * @returns The parsed JSON response typed as `T`.
 * @throws {ShopifyApiError} On non-2xx responses (after retries exhausted).
 *
 * @example
 * ```ts
 * const data = await shopifyRest<{ products: ShopifyProduct[] }>(
 *   session,
 *   "products.json?limit=10",
 * );
 * ```
 */
export async function shopifyRest<T>(
  session: Session,
  path: string,
  options?: ShopifyRestOptions,
): Promise<T> {
  const url = buildRestUrl(session.shopifyDomain, path);
  const method = options?.method ?? "GET";
  const fetchOptions: RequestInit = {
    method,
    headers: buildHeaders(session.accessToken),
  };

  if (options?.body != null) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetchWithRetry(url, fetchOptions);
  return parseResponse<T>(res);
}

// ---------------------------------------------------------------------------
// Public API — GraphQL client
// ---------------------------------------------------------------------------

/**
 * Perform a typed GraphQL call against the Shopify Admin API.
 *
 * @param session   - The current Shopify session.
 * @param query     - The GraphQL query/mutation string.
 * @param variables - Optional variables for the operation.
 * @returns The `data` portion of the GraphQL response typed as `T`.
 * @throws {ShopifyApiError} On HTTP errors.
 * @throws {Error} If the GraphQL response contains `errors`.
 *
 * @example
 * ```ts
 * const { products } = await shopifyGraphQL<{ products: { edges: { node: { id: string } }[] } }>(
 *   session,
 *   `query ($first: Int!) { products(first: $first) { edges { node { id } } } }`,
 *   { first: 10 },
 * );
 * ```
 */
export async function shopifyGraphQL<T>(
  session: Session,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = buildRestUrl(session.shopifyDomain, "graphql.json");
  const fetchOptions: RequestInit = {
    method: "POST",
    headers: buildHeaders(session.accessToken),
    body: JSON.stringify({ query, variables }),
  };

  const res = await fetchWithRetry(url, fetchOptions);
  const json = await parseResponse<ShopifyGraphQLResponse<T>>(res);

  // GraphQL-level errors (the HTTP request itself succeeded).
  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL errors: ${messages}`);
  }

  if (json.data === null) {
    throw new Error("GraphQL returned null data with no errors");
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Public API — Product helpers
// ---------------------------------------------------------------------------

/**
 * Search for products in a Shopify store via the REST Admin API.
 *
 * @param session - The current Shopify session.
 * @param query   - Optional search string (matched against product title).
 * @param limit   - Maximum number of products to return (default 50).
 * @returns Matching products.
 */
export async function searchProducts(
  session: Session,
  query?: string,
  limit = 50,
): Promise<ShopifyProduct[]> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (query) params.set("title", query);

  const data = await shopifyRest<{ products: ShopifyProduct[] }>(
    session,
    `products.json?${params.toString()}`,
  );
  return data.products;
}

/**
 * Fetch a single product by Shopify product ID.
 *
 * @param session   - The current Shopify session.
 * @param productId - The numeric Shopify product ID.
 */
export async function getProduct(
  session: Session,
  productId: string,
): Promise<ShopifyProduct> {
  const data = await shopifyRest<{ product: ShopifyProduct }>(
    session,
    `products/${productId}.json`,
  );
  return data.product;
}

// ---------------------------------------------------------------------------
// Public API — Collection helpers
// ---------------------------------------------------------------------------

/**
 * List all custom collections in the store.
 *
 * @param session - The current Shopify session.
 */
export async function getCollections(
  session: Session,
): Promise<ShopifyCollection[]> {
  const data = await shopifyRest<{ custom_collections: ShopifyCollection[] }>(
    session,
    "custom_collections.json?limit=250",
  );
  return data.custom_collections;
}

// ---------------------------------------------------------------------------
// Public API — Webhook helpers
// ---------------------------------------------------------------------------

/**
 * Register a new webhook subscription for a Shopify topic.
 *
 * @param session - The current Shopify session.
 * @param topic   - The webhook topic (e.g. `"app/uninstalled"`).
 * @param address - The HTTPS URL that will receive webhook POSTs.
 * @returns The created webhook registration.
 */
export async function createWebhook(
  session: Session,
  topic: string,
  address: string,
): Promise<ShopifyWebhook> {
  const data = await shopifyRest<{ webhook: ShopifyWebhook }>(
    session,
    "webhooks.json",
    {
      method: "POST",
      body: {
        webhook: { topic, address, format: "json" },
      },
    },
  );
  return data.webhook;
}

/**
 * Delete a registered webhook subscription by ID.
 *
 * @param session   - The current Shopify session.
 * @param webhookId - The numeric Shopify webhook ID.
 */
export async function deleteWebhook(
  session: Session,
  webhookId: string,
): Promise<void> {
  await shopifyRest<unknown>(
    session,
    `webhooks/${webhookId}.json`,
    { method: "DELETE" },
  );
}
