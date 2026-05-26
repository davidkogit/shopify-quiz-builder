/**
 * POST /api/admin/quizzes/[id]/duplicate — Duplicate a quiz
 *
 * Deep-copies the quiz with all questions, answers, results, result paths,
 * and logic configurations inside a transaction. The copy receives a new
 * unique key, `status = "draft"`, and `"[Name] (Copy)"` suffix unless an
 * explicit name is provided in the request body.
 *
 * Validates session → store → quiz ownership before operating.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";
import { duplicateQuiz } from "../../../../../../../lib/quiz-service";

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
// POST — Duplicate the quiz
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    // No body or malformed JSON → duplicate with default name
    body = {};
  }

  try {
    const quiz = await duplicateQuiz(
      prisma,
      result.quizId,
      body.name?.trim() || undefined,
    );
    return NextResponse.json({ quiz }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to duplicate quiz" },
      { status: 500 },
    );
  }
}
