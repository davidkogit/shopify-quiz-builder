/**
 * Quiz CRUD — Read, Update, Delete
 *
 * GET    /api/admin/quizzes/[id] — Get full quiz with nested data.
 * PUT    /api/admin/quizzes/[id] — Update quiz metadata.
 * DELETE /api/admin/quizzes/[id] — Delete quiz and all related data.
 *
 * Every handler validates session → store → quiz ownership before operating.
 * Cross-store access returns 403 Forbidden.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";
import {
  getQuizFull,
  updateQuiz,
  deleteQuiz,
} from "../../../../../../lib/quiz-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate the session cookie and resolve the authenticated store.
 */
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

/**
 * Validate session + store AND verify the quiz exists and belongs to the store.
 * Returns the quiz ID on success; an error response otherwise.
 */
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
// GET — Full quiz with nested questions, answers, and results
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    const quiz = await getQuizFull(prisma, result.quizId);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    return NextResponse.json({ quiz });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update quiz metadata (partial)
// ---------------------------------------------------------------------------

/** Allowed top-level fields for quiz metadata updates. */
const ALLOWED_UPDATE_FIELDS = [
  "name",
  "settings",
  "styles",
  "logicType",
  "productLimit",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Build an update payload containing only allowed fields present in the body
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  try {
    const quiz = await updateQuiz(
      prisma,
      result.quizId,
      data as Parameters<typeof updateQuiz>[2],
    );
    return NextResponse.json({ quiz });
  } catch {
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete quiz and all related data (cascade)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    await deleteQuiz(prisma, result.quizId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 },
    );
  }
}
