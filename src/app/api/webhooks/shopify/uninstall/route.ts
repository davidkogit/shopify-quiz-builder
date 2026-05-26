/**
 * POST /api/webhooks/shopify/uninstall — App Uninstalled Webhook
 *
 * Shopify fires this webhook when a merchant uninstalls the app.
 * The handler:
 *
 * 1. Reads the raw request body.
 * 2. Validates the HMAC-SHA256 signature (x-shopify-hmac-sha256 header).
 * 3. Extracts the shop domain from x-shopify-shop-domain.
 * 4. Cascade-deletes all store data via {@link deleteStore}.
 * 5. Returns 200 OK so Shopify stops retrying.
 *
 * HMAC verification uses constant-time comparison (crypto.timingSafeEqual)
 * to prevent timing attacks — consistent with the OAuth callback pattern.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../../../lib/env";
import { deleteStore } from "../../../../../../lib/store";
import { prisma } from "../../../../../../lib/prisma";
import { verifyWebhookHmac } from "../../../../../../lib/webhook-utils";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ---------- Read raw body (must happen before any other body consumption) ----------
  const rawBody = await req.text();

  // ---------- Extract required Shopify headers ----------
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const domain = req.headers.get("x-shopify-shop-domain");

  if (!hmac || !domain) {
    return new NextResponse(null, { status: 400 });
  }

  // ---------- Verify HMAC signature ----------
  if (!verifyWebhookHmac(rawBody, hmac, env.SHOPIFY_API_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }

  // ---------- Cascade-delete store data ----------
  await deleteStore(prisma, domain);

  return new NextResponse(null, { status: 200 });
}
