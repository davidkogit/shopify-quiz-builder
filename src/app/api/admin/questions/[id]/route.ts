/**
 * Question CRUD — Read, Update, Delete (individual question)
 *
 * GET    /api/admin/questions/[id] — Get single question with answers.
 * PUT    /api/admin/questions/[id] — Update question fields.
 * DELETE /api/admin/questions/[id] — Delete question and cascade answers.
 *
 * Every handler validates session → store → quiz ownership via the
 * question→quiz→store relationship chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";
import {
  getQuestion,
  updateQuestion,
  deleteQuestion,
} from "../../../../../../lib/question-service";

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
// GET — Single question with answers
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuestionOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    const question = await getQuestion(prisma, result.questionId);
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ question });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch question" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update question fields (partial)
// ---------------------------------------------------------------------------

/** Allowed top-level fields for question updates. */
const ALLOWED_UPDATE_FIELDS = [
  "type",
  "order",
  "title",
  "subtitle",
  "description",
  "image",
  "required",
  "settings",
  "isDraft",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuestionOwnership(req, id);
  if (!result.ok) return result.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Build update payload with only allowed fields present in the body
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
    const question = await updateQuestion(
      prisma,
      result.questionId,
      data as Parameters<typeof updateQuestion>[2],
    );
    return NextResponse.json({ question });
  } catch {
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete question and cascade all answers
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuestionOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    await deleteQuestion(prisma, result.questionId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 },
    );
  }
}
