/**
 * Shared Admin API Authentication Helpers
 *
 * Common session → store resolution used across admin API route handlers.
 * Each route needs to validate the Shopify session cookie and look up the
 * corresponding Store record before any data operation.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie, type Session } from "./session";
import { getStore } from "./store";
import { env } from "./env";
import { prisma } from "./prisma";

/**
 * Resolve the store from the session cookie on the incoming request.
 *
 * Returns either a `NextResponse` error (401/404) to short-circuit the
 * handler, or `{ session, storeId }` on success.
 *
 * @example
 * ```ts
 * const resolved = await resolveStore(req);
 * if (resolved instanceof NextResponse) return resolved;
 * const { session, storeId } = resolved;
 * ```
 */
export async function resolveStore(
  req: NextRequest,
): Promise<{ session: Session; storeId: string } | NextResponse> {
  const session = await getSessionFromCookie(req.cookies, env.SESSION_SECRET);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized — missing or invalid session" },
      { status: 401 },
    );
  }

  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return NextResponse.json(
      { error: "Store not found" },
      { status: 404 },
    );
  }

  return { session, storeId: store.id };
}
