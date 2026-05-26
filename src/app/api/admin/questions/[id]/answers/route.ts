/**
 * Answer CRUD — List & Create (scoped to a question)
 *
 * GET  /api/admin/questions/[id]/answers — List all answers for a question.
 * POST /api/admin/questions/[id]/answers — Create a new answer.
 *
 * Every handler validates session → store → question → quiz ownership before
 * operating.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";
import {
  getAnswers,
  createAnswer,
} from "../../../../../../../lib/answer-service";

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
 * Validate session + store AND verify the question exists and belongs to
 * a quiz owned by the authenticated store.
 */
async function resolveQuestionOwnership(
  req: NextRequest,
  questionId: string,
): Promise<
  | { ok: true; storeId: string; questionId: string; quizId: string }
  | { ok: false; response: NextResponse }
> {
  const storeResult = await resolveStore(req);
  if (!storeResult.ok) return storeResult;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      quizId: true,
      quiz: { select: { storeId: true } },
    },
  });

  if (!question) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      ),
    };
  }

  if (question.quiz.storeId !== storeResult.storeId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — question belongs to a different store" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    storeId: storeResult.storeId,
    questionId: question.id,
    quizId: question.quizId,
  };
}

// ---------------------------------------------------------------------------
// GET — List all answers for a question (ordered)
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuestionOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    const answers = await getAnswers(prisma, result.questionId);
    return NextResponse.json({ answers });
  } catch {
    return NextResponse.json(
      { error: "Failed to list answers" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new answer in the question
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuestionOwnership(req, id);
  if (!result.ok) return result.response;

  let body: { title?: string };
  try {
    body = (await req.json()) as { title?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const answer = await createAnswer(prisma, result.questionId, { title });
    return NextResponse.json({ answer }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create answer" },
      { status: 500 },
    );
  }
}
