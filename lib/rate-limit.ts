/**
 * In-Memory Rate Limiter
 *
 * Tracks request counts per key within a sliding time window using a Map.
 * Designed for single-process deployments (Netlify Dev, small-scale hosting).
 * For multi-process/production, replace with Redis-backed limiter.
 *
 * @example
 * ```ts
 * import { rateLimit, getClientIp } from "@/../lib/rate-limit";
 * const { allowed } = rateLimit(`quiz:${getClientIp(req)}`, 60, 60_000);
 * if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 * ```
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  /** Number of requests made in the current window. */
  count: number;
  /** Timestamp (ms) when the current window resets. */
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Clean up expired entries every 60 seconds so the Map doesn't grow unbounded. */
const CLEANUP_INTERVAL_MS = 60_000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Don't keep the Node.js process alive just for cleanup
if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
  cleanupTimer.unref();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a request identified by `key` is within the rate limit.
 *
 * @param key - Unique identifier for the client (e.g. `quiz:${ip}`).
 * @param maxRequests - Maximum number of requests allowed per window.
 * @param windowMs - Time window in milliseconds.
 * @returns An object with `allowed` (boolean) and `remaining` (number) fields.
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  // No existing entry, or the previous window has expired — start fresh
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // Window is still open but limit has been reached
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  // Increment count within the current window
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Extract the client IP address from a Next.js request.
 *
 * Checks `x-forwarded-for` first (standard proxy header), then falls back to
 * `x-real-ip` (common with nginx), and finally the raw connection address.
 *
 * @param req - The incoming Next.js request.
 * @returns The client IP string, or "unknown" if none can be determined.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // The leftmost IP is the original client (proxies append to the right)
    return forwarded.split(",")[0]!.trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
