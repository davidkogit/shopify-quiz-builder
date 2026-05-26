/**
 * POST /api/admin/quizzes/[id]/publish — Publish a quiz
 *
 * Sets the quiz status to "published" so it can be embedded on the storefront.
 * Validates session → store → quiz ownership before operating.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";
import { publishQuiz } from "../../../../../../../lib/quiz-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveStore(
  req: NextRequest,
): Promise<
  | { ok: true; storeId: string }
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

  return { ok: true, storeId: store.id };
}

async function resolveQuizOwnership(
  req: NextRequest,
  quizId: string,
): Promise<
  | { ok: true; storeId: string; quizId: string }
  | { ok: false; response: NextResponse }
> {
  const storeResult = await resolveStore(req);
  if (!storeResult.ok) return storeResult;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, storeId: true },
  });

  if (!quiz) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Quiz not found" }, { status: 404 }),
    };
  }

  if (quiz.storeId !== storeResult.storeId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — quiz belongs to a different store" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, storeId: storeResult.storeId, quizId: quiz.id };
}

// ---------------------------------------------------------------------------
// POST — Publish the quiz
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    const quiz = await publishQuiz(prisma, result.quizId);
    return NextResponse.json({ quiz });
  } catch {
    return NextResponse.json(
      { error: "Failed to publish quiz" },
      { status: 500 },
    );
  }
}
