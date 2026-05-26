/**
 * Quiz Logic Evaluation API
 *
 * POST /api/admin/quizzes/[id]/evaluate
 *
 * Evaluates user-submitted answers against the quiz's configured logic type
 * and returns the matched result and/or recommended products enriched with
 * Shopify data.
 *
 * Every handler validates session → store → quiz ownership before evaluating.
 *
 * @see /workspace/plans/2026-05-18-quiz-kit-replication-plan.md — Core Algorithms
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";
import { getProduct } from "../../../../../../../lib/shopify";
import {
  evaluateBasicLogic,
  evaluateSingleLogic,
  evaluatePointsLogic,
  evaluateProductWeightLogic,
  evaluateResultWeightLogic,
  evaluateCombinationLogic,
  type UserAnswer,
} from "../../../../../../../lib/logic-engine";
import type { Session } from "../../../../../../../lib/session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the numeric ID from a Shopify GID string (e.g. gid://shopify/Product/123 → "123"). */
function extractNumericId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] || gid;
}

/**
 * Validate the session cookie and resolve the authenticated store.
 * Returns the {@link Session} object so downstream code can call Shopify APIs.
 */
async function resolveSession(
  req: NextRequest,
): Promise<
  | { ok: true; session: Session; storeId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromCookie(req.cookies, env.SESSION_SECRET);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized — missing or invalid session" },
        { status: 401 },
      ),
    };
  }

  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Store not found" }, { status: 404 }),
    };
  }

  return { ok: true, session, storeId: store.id };
}

/**
 * Fetch Shopify product details (title, first image) for a list of GID-format
 * product IDs.  Individual fetch failures are silently swallowed — the entry
 * is returned with only `shopifyProductId`.
 *
 * Preserves the **input order** so callers can control sort order (important
 * for Product Weight logic whose results are already score-sorted).
 */
async function enrichProducts(
  session: Session,
  productIds: string[],
): Promise<{ shopifyProductId: string; title?: string; image?: string }[]> {
  if (productIds.length === 0) return [];

  const results = await Promise.allSettled(
    productIds.map((gid) => getProduct(session, extractNumericId(gid))),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") {
      return {
        shopifyProductId: productIds[i],
        title: r.value.title,
        image: r.value.images?.[0]?.src,
      };
    }
    return { shopifyProductId: productIds[i] };
  });
}

// ---------------------------------------------------------------------------
// POST — Evaluate quiz logic with user answers
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // 1. Authenticate + resolve store (returns session for Shopify calls)
  const sessionResult = await resolveSession(req);
  if (!sessionResult.ok) return sessionResult.response;
  const { session, storeId } = sessionResult;

  // 2. Validate quiz existence + ownership
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true, storeId: true, logicType: true },
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  if (quiz.storeId !== storeId) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  // 3. Parse and validate request body
  let body: { answers?: UserAnswer[] };
  try {
    body = (await req.json()) as { answers?: UserAnswer[] };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.answers || !Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "Missing or malformed 'answers' array" },
      { status: 400 },
    );
  }

  const answers = body.answers;

  // 4. Dispatch to the correct evaluate* function based on logicType
  try {
    switch (quiz.logicType) {
      case "basic": {
        const result = await evaluateBasicLogic(prisma, id, answers);
        return NextResponse.json({ result, products: [] });
      }

      case "single": {
        const { productIds } = await evaluateSingleLogic(prisma, id, answers);
        const products = await enrichProducts(session, productIds);
        return NextResponse.json({ result: null, products });
      }

      case "points": {
        const result = await evaluatePointsLogic(prisma, id, answers);
        return NextResponse.json({ result, products: [] });
      }

      case "productWeight": {
        const weighted = await evaluateProductWeightLogic(prisma, id, answers);
        const products = await enrichProducts(
          session,
          weighted.map((w) => w.shopifyProductId),
        );
        return NextResponse.json({ result: null, products });
      }

      case "resultWeight": {
        const result = await evaluateResultWeightLogic(prisma, id, answers);
        return NextResponse.json({ result, products: [] });
      }

      case "combination": {
        const { result, productIds } = await evaluateCombinationLogic(
          prisma,
          id,
          answers,
        );
        const products = await enrichProducts(session, productIds);
        return NextResponse.json({ result, products });
      }

      default:
        return NextResponse.json(
          { error: `Unknown logic type: ${quiz.logicType}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Logic evaluation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
