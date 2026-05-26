/**
 * Public Quiz Analytics Events API
 *
 * POST /api/public/quiz/[key]/events — Track browser-side analytics events
 * (quiz_started, question_answered, quiz_completed, add_to_cart,
 * customer_subscribed). No Shopify session required — public endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";
import { rateLimit, getClientIp } from "../../../../../../../lib/rate-limit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Allowed analytics event types. */
const VALID_EVENTS = new Set([
  "quiz_started",
  "question_answered",
  "quiz_completed",
  "add_to_cart",
  "customer_subscribed",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a published quiz by key. Returns only the fields needed for event tracking. */
async function findQuizForEvents(key: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { key },
    select: { id: true, storeId: true, status: true },
  });
  if (!quiz || quiz.status !== "published") return null;
  return quiz;
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  // Rate limit: 60 requests per minute per IP
  const clientIp = getClientIp(req);
  const limitKey = `quiz:events:${clientIp}`;
  const { allowed } = rateLimit(limitKey, 60, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  try {
    const { key } = await params;

    // 1. Parse request body
    let body: {
      sessionId?: string;
      event?: string;
      questionId?: string;
      answerId?: string;
      variantId?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 2. Validate required fields and allowed event types
    if (!body.sessionId || !body.event || !VALID_EVENTS.has(body.event)) {
      return NextResponse.json(
        { error: "Missing or invalid fields: sessionId and event are required" },
        { status: 400 },
      );
    }

    // 3. Verify quiz exists and is published
    const quiz = await findQuizForEvents(key);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // 4. Persist analytics event (include variantId in data if present)
    await prisma.analyticsEvent.create({
      data: {
        storeId: quiz.storeId,
        quizId: quiz.id,
        sessionId: body.sessionId,
        event: body.event,
        questionId: body.questionId ?? null,
        answerId: body.answerId ?? null,
        data: JSON.stringify(body.variantId ? { variantId: body.variantId } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to track event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
