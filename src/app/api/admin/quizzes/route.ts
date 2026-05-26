/**
 * Quiz CRUD — List & Create
 *
 * GET  /api/admin/quizzes — List all quizzes for the authenticated store.
 * POST /api/admin/quizzes — Create a new quiz (body: { name, logicType? }).
 *
 * Every handler validates the Shopify session cookie and resolves the
 * corresponding Store record before any data operation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../lib/session";
import { getStore } from "../../../../../lib/store";
import { env } from "../../../../../lib/env";
import { prisma } from "../../../../../lib/prisma";
import { createQuiz } from "../../../../../lib/quiz-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the store from the session cookie.
 * Returns either the store ID or an error response to short-circuit the handler.
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

// ---------------------------------------------------------------------------
// GET — List all quizzes for the store
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const result = await resolveStore(req);
  if (!result.ok) return result.response;

  try {
    const quizzesWithCounts = await prisma.quiz.findMany({
      where: { storeId: result.storeId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { questions: true } } },
    });
    return NextResponse.json({ quizzes: quizzesWithCounts });
  } catch {
    return NextResponse.json(
      { error: "Failed to list quizzes" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new quiz
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await resolveStore(req);
  if (!result.ok) return result.response;

  let body: { name?: string; logicType?: string };
  try {
    body = (await req.json()) as { name?: string; logicType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const quiz = await createQuiz(
      prisma,
      result.storeId,
      name,
      body.logicType || "basic",
    );
    return NextResponse.json({ quiz }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 },
    );
  }
}
