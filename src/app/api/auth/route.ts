/**
 * GET /api/auth — Initiate Shopify OAuth
 *
 * Redirects the merchant to the Shopify Admin OAuth authorization page so
 * they can grant the scopes required by the app.
 *
 * The route:
 * 1. Reads and sanitises the `shop` query parameter.
 * 2. Generates a cryptographically random `nonce` for CSRF protection.
 * 3. Stores the nonce in a short-lived, HTTP-only cookie.
 * 4. Redirects the browser to Shopify's OAuth consent screen.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "../../../../lib/env";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Sanitise a shop domain string.
 *
 * Strips protocol & path, lowercases, and validates the `.myshopify.com`
 * suffix. Returns the clean domain or `null` on invalid input.
 */
function sanitiseShop(raw: string): string | null {
  const clean = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(clean)) {
    return null;
  }
  return clean;
}

/**
 * Build the Shopify OAuth authorisation URL.
 *
 * Pure — same inputs always produce the same URL (modulo the random nonce
 * which is generated externally and passed in).
 */
function buildAuthUrl(
  shop: string,
  nonce: string,
  apiKey: string,
  scopes: string,
  redirectUri: string,
): string {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", nonce);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const shopParam = req.nextUrl.searchParams.get("shop");

  if (!shopParam) {
    return NextResponse.json(
      { error: "Missing 'shop' query parameter" },
      { status: 400 },
    );
  }

  const shop = sanitiseShop(shopParam);
  if (!shop) {
    return NextResponse.json(
      { error: "Invalid shop domain" },
      { status: 400 },
    );
  }

  // Generate a CSRF nonce and store it in a cookie for callback verification
  const nonce = crypto.randomBytes(16).toString("hex");

  const redirectUri = `${env.HOST}/api/auth/callback`;
  const authUrl = buildAuthUrl(
    shop,
    nonce,
    env.SHOPIFY_API_KEY,
    env.SHOPIFY_SCOPES,
    redirectUri,
  );

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("shopify_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes — plenty of time for the merchant to approve
  });

  return response;
}
