/**
 * Public Quiz Submission API
 *
 * POST /api/public/quiz/[key]/submit — Evaluate user answers against the quiz's
 * logic engine, return matched result + recommended products, and persist a
 * Submission record with an analytics event.
 *
 * No Shopify session required — access is gated by the quiz key + status check.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";
import { rateLimit, getClientIp } from "../../../../../../../lib/rate-limit";
import { getProduct } from "../../../../../../../lib/shopify";
import type { Session } from "../../../../../../../lib/session";
import {
  evaluateBasicLogic,
  evaluateSingleLogic,
  evaluatePointsLogic,
  evaluateProductWeightLogic,
  evaluateResultWeightLogic,
  evaluateCombinationLogic,
} from "../../../../../../../lib/logic-engine";
import type { UserAnswer } from "../../../../../../../lib/logic-engine";
import {
  sendQuizResultEmail,
  buildResultEmailHtml,
} from "../../../../../../../lib/email";
import { safeJsonParse } from "../../../../../../../lib/json-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmitBody {
  sessionId: string;
  answers: UserAnswer[];
  email?: string;
  phone?: string;
  name?: string;
}

interface RecommendedProduct {
  id: string;
  title: string;
  imageUrl: string;
  price: string;
}

interface PublicResult {
  id: string;
  title: string;
  description: string | null;
  outcomeType: string;
  outcomeData: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the numeric ID from a Shopify GID (e.g. gid://shopify/Product/123 → "123"). */
function extractNumericId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] || gid;
}

/** Look up a published quiz with its store (needed for Shopify API auth and email). */
async function findQuizWithStore(key: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { key },
    include: {
      store: {
        select: { id: true, shopifyDomain: true, accessToken: true, scopes: true, emailSettings: true },
      },
    },
  });
  if (!quiz || quiz.status !== "published") return null;
  return quiz;
}

/**
 * Fetch Shopify product details for a list of GID-format product IDs.
 * Individual failures are silently swallowed — the entry is returned with
 * only `shopifyProductId`.
 */
async function enrichProducts(
  session: Session,
  productIds: string[],
): Promise<
  { shopifyProductId: string; title?: string; image?: string; price?: string }[]
> {
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
        price: r.value.variants?.[0]?.price,
      };
    }
    return { shopifyProductId: productIds[i] };
  });
}

/** Map an enriched product entry to the public API response shape. */
function toRecommendedProduct(p: {
  shopifyProductId: string;
  title?: string;
  image?: string;
  price?: string;
}): RecommendedProduct {
  return {
    id: p.shopifyProductId,
    title: p.title ?? "",
    imageUrl: p.image ?? "",
    price: p.price ?? "0",
  };
}

/** Trim a Result record to the public-safe fields. */
function toPublicResult(r: {
  id: string;
  title: string;
  description: string | null;
  outcomeType: string;
  outcomeData: string;
}): PublicResult {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    outcomeType: r.outcomeType,
    outcomeData: JSON.parse(r.outcomeData),
  };
}

// ---------------------------------------------------------------------------
// Logic Engine Dispatch
// ---------------------------------------------------------------------------

/**
 * Run the appropriate evaluate function based on the quiz's logicType.
 * Returns a unified { result, productIds } tuple for downstream processing.
 */
async function evaluateByType(
  quizId: string,
  logicType: string,
  answers: UserAnswer[],
): Promise<{ result: PublicResult | null; productIds: string[] }> {
  switch (logicType) {
    case "basic": {
      const r = await evaluateBasicLogic(prisma, quizId, answers);
      return { result: r ? toPublicResult(r) : null, productIds: [] };
    }
    case "single": {
      const { productIds } = await evaluateSingleLogic(prisma, quizId, answers);
      return { result: null, productIds };
    }
    case "points": {
      const r = await evaluatePointsLogic(prisma, quizId, answers);
      return { result: r ? toPublicResult(r) : null, productIds: [] };
    }
    case "productWeight": {
      const weighted = await evaluateProductWeightLogic(prisma, quizId, answers);
      return {
        result: null,
        productIds: weighted.map((w) => w.shopifyProductId),
      };
    }
    case "resultWeight": {
      const r = await evaluateResultWeightLogic(prisma, quizId, answers);
      return { result: r ? toPublicResult(r) : null, productIds: [] };
    }
    case "combination": {
      const { result, productIds } = await evaluateCombinationLogic(
        prisma,
        quizId,
        answers,
      );
      return {
        result: result ? toPublicResult(result) : null,
        productIds,
      };
    }
    default:
      throw new Error(`Unknown logic type: ${logicType}`);
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  // Rate limit: 10 requests per minute per IP (protects Shopify API quota)
  const clientIp = getClientIp(req);
  const limitKey = `quiz:submit:${clientIp}`;
  const { allowed } = rateLimit(limitKey, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  try {
    const { key } = await params;

    // 1. Parse and validate request body
    let body: SubmitBody;
    try {
      body = (await req.json()) as SubmitBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
    }

    if (
      !body.sessionId ||
      !body.answers ||
      !Array.isArray(body.answers) ||
      body.answers.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId and answers" },
        { status: 422 },
      );
    }

    // 2. Look up quiz (must be published)
    const quiz = await findQuizWithStore(key);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // 3. Build a Session for Shopify Admin API calls
    const session: Session = {
      shopifyDomain: quiz.store.shopifyDomain,
      accessToken: quiz.store.accessToken,
      scopes: quiz.store.scopes,
    };

    // 4. Evaluate answers through the logic engine
    const { result, productIds } = await evaluateByType(
      quiz.id,
      quiz.logicType,
      body.answers,
    );

    // 5. Enrich product data from Shopify
    const enriched = await enrichProducts(session, productIds);
    const recommendedProducts = enriched.map(toRecommendedProduct);

    // 6. Persist submission record
    const submission = await prisma.submission.create({
      data: {
        quizId: quiz.id,
        storeId: quiz.store.id,
        sessionId: body.sessionId,
        email: body.email ?? null,
        phone: body.phone ?? null,
        name: body.name ?? null,
        answers: JSON.stringify(body.answers),
        resultId: result?.id ?? null,
        recommendedProducts: JSON.stringify(recommendedProducts),
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    // 7. Track analytics event for quiz completion
    await prisma.analyticsEvent.create({
      data: {
        storeId: quiz.store.id,
        quizId: quiz.id,
        sessionId: body.sessionId,
        event: "quiz_completed",
      },
    });

    // 8. Send result email (fire-and-forget — never blocks the response)
    if (body.email) {
      const storeEmailSettings = safeJsonParse<{ enabled?: boolean }>(
        quiz.store.emailSettings,
        {},
      );
      const quizSettings = safeJsonParse<{
        emailEnabled?: boolean;
        emailSubject?: string;
      }>(quiz.settings, {});

      if (storeEmailSettings?.enabled && quizSettings?.emailEnabled) {
        const subject =
          quizSettings.emailSubject || `Your ${quiz.name} Results`;
        const emailHtml = buildResultEmailHtml({
          quizName: quiz.name,
          resultTitle: result?.title ?? "Your Results",
          resultDescription: result?.description ?? null,
          products: recommendedProducts.map((p) => ({
            title: p.title,
            image: p.imageUrl,
          })),
        });

        // Fire-and-forget: log errors but never affect the 200 response
        sendQuizResultEmail({ to: body.email, subject, html: emailHtml }).catch(
          (err) => console.error("Failed to send result email:", err),
        );
      }
    }

    // 9. Return result + recommended products
    return NextResponse.json({
      submissionId: submission.id,
      result,
      recommendedProducts,
    });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
