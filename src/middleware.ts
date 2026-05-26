/**
 * Edge Middleware — Session Guard
 *
 * Runs on every request to `/` (admin routes).  Checks whether the
 * `shopify_session` cookie exists and has a plausibly-valid encrypted
 * value.  If absent or invalid, redirects to the Shopify OAuth
 * install flow.
 *
 * Full session validation happens later in admin layout and API
 * routes — this is a lightweight first-pass guard.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Encrypted session cookies are hex-encoded AES-GCM — must be ≥ 32 hex chars. */
function isPlausibleSession(value: string | undefined): boolean {
  return !!value && /^[0-9a-fA-F]{32,}$/.test(value);
}

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("shopify_session");
  const { pathname, searchParams } = request.nextUrl;

  // Allow auth and API routes to pass through.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // No valid-looking session → redirect to OAuth install.
  if (!isPlausibleSession(sessionCookie?.value)) {
    const shop = searchParams.get("shop") ?? "";

    const installUrl = new URL("/api/auth", request.url);
    if (shop) installUrl.searchParams.set("shop", shop);

    return NextResponse.redirect(installUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico (favicon)
     * - api/ (handled inside the function)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
