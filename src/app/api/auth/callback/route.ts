/**
 * GET /api/auth/callback — Shopify OAuth Callback
 *
 * Shopify redirects the merchant here after they approve (or deny) the
 * requested scopes. This route:
 *
 * 1. Extracts and validates query parameters (code, shop, state, hmac).
 * 2. Verifies the CSRF `state` nonce against the cookie set in `/api/auth`.
 * 3. Validates the HMAC signature to ensure the request originated from Shopify.
 * 4. Exchanges the authorisation code for a persistent (offline) access token.
 * 5. Stores the session in an encrypted cookie via `lib/session.ts`.
 * 6. Redirects the merchant to the app dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "../../../../../lib/env";
import {
  setSessionCookie,
  type Session,
} from "../../../../../lib/session";
import { upsertStore } from "../../../../../lib/store";
import { prisma } from "../../../../../lib/prisma";
import { createWebhook } from "../../../../../lib/shopify";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Validate the HMAC signature Shopify attaches to every OAuth callback.
 *
 * Reconstructs the signed message from **all** query parameters *except*
 * `hmac` and `signature`, sorted alphabetically. Then compares the
 * HMAC-SHA256 digest (hex-encoded) with the provided `hmac` value using
 * a constant-time comparison to prevent timing attacks.
 */
function validateHmac(
  params: URLSearchParams,
  hmac: string,
  secret: string,
): boolean {
  const message = [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("&");

  const generated = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(generated, "hex"),
    Buffer.from(hmac, "hex"),
  );
}

/**
 * Exchange an OAuth authorisation code for an offline access token.
 *
 * Makes a POST request to Shopify's `/admin/oauth/access_token` endpoint.
 * Returns the access token string, or `null` on any failure.
 */
async function exchangeCodeForToken(
  shop: string,
  code: string,
  apiKey: string,
  apiSecret: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");

  // ---------- Guard: required query parameters ----------
  if (!code || !shop || !state || !hmac) {
    return NextResponse.json(
      { error: "Missing required OAuth callback parameters" },
      { status: 400 },
    );
  }

  // ---------- CSRF: validate state nonce ----------
  const nonceCookie = req.cookies.get("shopify_nonce");
  if (!nonceCookie || nonceCookie.value !== state) {
    return NextResponse.json(
      { error: "Invalid state parameter — possible CSRF attack" },
      { status: 403 },
    );
  }

  // ---------- Authenticity: validate HMAC ----------
  if (!validateHmac(searchParams, hmac, env.SHOPIFY_API_SECRET)) {
    return NextResponse.json(
      { error: "Invalid HMAC signature" },
      { status: 403 },
    );
  }

  // ---------- Exchange code for access token ----------
  const accessToken = await exchangeCodeForToken(
    shop,
    code,
    env.SHOPIFY_API_KEY,
    env.SHOPIFY_API_SECRET,
  );

  if (!accessToken) {
    return NextResponse.json(
      { error: "Failed to exchange authorisation code for access token" },
      { status: 500 },
    );
  }

  // ---------- Build session and persist to database ----------
  const session: Session = {
    shopifyDomain: shop,
    accessToken,
    scopes: env.SHOPIFY_SCOPES,
  };

  // Persist (or update) the store record so the database is in sync.
  // Catch errors so a database outage doesn't block OAuth install.
  try {
    await upsertStore(prisma, shop, accessToken, env.SHOPIFY_SCOPES);
  } catch (err) {
    console.error("Failed to upsert store during OAuth callback:", err instanceof Error ? err.message : err);
  }

  // Register the app/uninstalled webhook (fire-and-forget — non-blocking)
  createWebhook(
    session,
    "app/uninstalled",
    `${env.HOST}/api/webhooks/shopify/uninstall`,
  ).catch(() => {
    // Best-effort: the webhook can be re-registered later if needed
  });

  const response = NextResponse.redirect(new URL("/", env.HOST));
  await setSessionCookie(session, env.SESSION_SECRET, response.cookies);

  // Clean up the nonce cookie — it's single-use
  response.cookies.delete("shopify_nonce");

  return response;
  } catch (err) {
    console.error("OAuth callback failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Internal server error during OAuth callback" },
      { status: 500 },
    );
  }
}
