/**
 * Answer CRUD — Read, Update, Delete (individual answer)
 *
 * GET    /api/admin/answers/[id] — Get single answer with related data.
 * PUT    /api/admin/answers/[id] — Update answer fields.
 * DELETE /api/admin/answers/[id] — Delete answer and cascade related links.
 *
 * Every handler validates session → store → answer ownership via the
 * answer→question→quiz→store relationship chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";
import {
  getAnswer,
  updateAnswer,
  deleteAnswer,
} from "../../../../../../lib/answer-service";

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
 * Validate session + store AND verify the answer exists and belongs to
 * a question → quiz owned by the authenticated store.
 */
async function resolveAnswerOwnership(
  req: NextRequest,
  answerId: string,
): Promise<
  | { ok: true; storeId: string; answerId: string; questionId: string; quizId: string }
  | { ok: false; response: NextResponse }
> {
  const storeResult = await resolveStore(req);
  if (!storeResult.ok) return storeResult;

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      questionId: true,
      question: {
        select: {
          id: true,
          quizId: true,
          quiz: { select: { storeId: true } },
        },
      },
    },
  });

  if (!answer) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Answer not found" },
        { status: 404 },
      ),
    };
  }

  if (answer.question.quiz.storeId !== storeResult.storeId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — answer belongs to a different store" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    storeId: storeResult.storeId,
    answerId: answer.id,
    questionId: answer.questionId,
    quizId: answer.question.quizId,
  };
}

// ---------------------------------------------------------------------------
// GET — Single answer with related data
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveAnswerOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    const answer = await getAnswer(prisma, result.answerId);
    if (!answer) {
      return NextResponse.json(
        { error: "Answer not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch answer" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Update answer fields (partial)
// ---------------------------------------------------------------------------

/** Allowed top-level fields for answer updates. */
const ALLOWED_UPDATE_FIELDS = [
  "title",
  "image",
  "description",
  "order",
  "points",
  "tags",
  "leadsToQuestionId",
  "settings",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveAnswerOwnership(req, id);
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
    const answer = await updateAnswer(
      prisma,
      result.answerId,
      data as Parameters<typeof updateAnswer>[2],
    );
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { error: "Failed to update answer" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete answer and cascade all related links
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveAnswerOwnership(req, id);
  if (!result.ok) return result.response;

  try {
    await deleteAnswer(prisma, result.answerId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete answer" },
      { status: 500 },
    );
  }
}
