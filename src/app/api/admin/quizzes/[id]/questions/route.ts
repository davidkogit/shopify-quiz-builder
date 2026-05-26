/**
 * Question CRUD — List & Create (scoped to a quiz)
 *
 * GET  /api/admin/quizzes/[id]/questions — List all questions for a quiz.
 * POST /api/admin/quizzes/[id]/questions — Create a new question.
 *
 * Every handler validates session → store → quiz ownership before operating.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";
import {
  getQuestions,
  createQuestion,
} from "../../../../../../../lib/question-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate the session cookie and resolve the authenticated store. */
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
 * Validate session + store AND verify the quiz exists and is owned by
 * the authenticated store.
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
// GET — List all questions for a quiz (with answers)
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    const questions = await getQuestions(prisma, result.quizId);
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json(
      { error: "Failed to list questions" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new question in the quiz
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  let body: { type?: string; title?: string };
  try {
    body = (await req.json()) as { type?: string; title?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type?.trim() || "radio";
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const question = await createQuestion(prisma, result.quizId, {
      type,
      title,
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 },
    );
  }
}
