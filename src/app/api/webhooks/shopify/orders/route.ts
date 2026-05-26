/**
 * POST /api/webhooks/shopify/orders — Order Attribution Webhook
 *
 * Shopify fires the `orders/create` webhook when a new order is placed.
 * This handler:
 *
 * 1. Reads the raw request body.
 * 2. Validates the HMAC-SHA256 signature (x-shopify-hmac-sha256 header).
 * 3. Extracts the shop domain from x-shopify-shop-domain.
 * 4. Looks up the Store record.
 * 5. Attempts to attribute the order to a quiz Submission by matching
 *    the customer's email against submissions created within a 10-day
 *    attribution window.
 * 6. On match: creates an OrderAttribution record and an AnalyticsEvent
 *    with event type "order_attributed".
 * 7. On no match: returns 200 OK (successful receipt — not an error).
 *
 * The endpoint does NOT require a Shopify session cookie — it is called
 * by Shopify's servers, not by the merchant's browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../../../lib/env";
import { getStore } from "../../../../../../lib/store";
import { prisma } from "../../../../../../lib/prisma";
import { verifyWebhookHmac } from "../../../../../../lib/webhook-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Relevant fields extracted from the Shopify `orders/create` webhook body. */
interface ShopifyOrderPayload {
  id: string;
  email?: string;
  total_price: string;
  created_at: string;
  line_items?: unknown[];
}

/** Shape of the JSON response returned to Shopify. */
interface AttributionResponse {
  attributed: boolean;
  submissionId: string | null;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Compute the start of the attribution window (10 days before the given date).
 */
function attributionWindowStart(orderDate: Date): Date {
  return new Date(orderDate.getTime() - 10 * 24 * 60 * 60 * 1000);
}

/**
 * Normalise an email for case-insensitive comparison.
 */
function normaliseEmail(email: string): string {
  return email.toLowerCase().trim();
}

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

  // ---------- Look up store ----------
  const store = await getStore(prisma, domain);
  if (!store) {
    // Store not installed — still return 200 so Shopify does not retry.
    console.log(
      `[order-attribution] Unknown store: ${domain} — skipping attribution`,
    );
    return NextResponse.json({ attributed: false, submissionId: null } satisfies AttributionResponse);
  }

  // ---------- Parse webhook body ----------
  let order: ShopifyOrderPayload;
  try {
    order = JSON.parse(rawBody) as ShopifyOrderPayload;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const shopifyOrderId = order.id;
  const email = order.email;
  const orderTotal = parseFloat(order.total_price) || 0;
  const orderCreatedAt = new Date(order.created_at);

  // ---------- Dedup: skip if this order has already been attributed ----------
  const existing = await prisma.orderAttribution.findFirst({
    where: { shopifyOrderId },
  });

  if (existing) {
    console.log(
      `[order-attribution] Duplicate order: ${shopifyOrderId} — already attributed`,
    );
    return NextResponse.json({
      attributed: true,
      submissionId: existing.submissionId ?? null,
    } satisfies AttributionResponse);
  }

  // ---------- Match submission by email within 10-day window ----------
  let attributed = false;
  let matchedSubmissionId: string | null = null;
  let matchedQuizId: string | null = null;

  if (email) {
    const normalised = normaliseEmail(email);
    const windowStart = attributionWindowStart(orderCreatedAt);

    const recentSubmissions = await prisma.submission.findMany({
      where: {
        storeId: store.id,
        email: { not: null },
        createdAt: { gte: windowStart, lte: orderCreatedAt },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, quizId: true, email: true },
    });

    const match = recentSubmissions.find(
      (s) => s.email !== null && normaliseEmail(s.email) === normalised,
    );

    if (match) {
      attributed = true;
      matchedSubmissionId = match.id;
      matchedQuizId = match.quizId;
    }
  }

  // ---------- Persist attribution when a match is found ----------
  if (attributed && matchedQuizId) {
    await prisma.orderAttribution.create({
      data: {
        storeId: store.id,
        quizId: matchedQuizId,
        submissionId: matchedSubmissionId,
        shopifyOrderId,
        orderTotal,
      },
    });

    // Track the attribution event for analytics dashboards.
    await prisma.analyticsEvent.create({
      data: {
        storeId: store.id,
        quizId: matchedQuizId,
        sessionId: `webhook:${shopifyOrderId}`,
        event: "order_attributed",
        data: JSON.stringify({
          shopifyOrderId,
          orderTotal,
          submissionId: matchedSubmissionId,
        }),
      },
    });
  }

  // ---------- Log for observability ----------
  console.log(
    `[order-attribution] shopifyOrderId=${shopifyOrderId} ` +
      `store=${domain} attributed=${attributed} ` +
      `submissionId=${matchedSubmissionId ?? "none"} ` +
      `orderTotal=${orderTotal}`,
  );

  return NextResponse.json({
    attributed,
    submissionId: matchedSubmissionId,
  } satisfies AttributionResponse);
}
