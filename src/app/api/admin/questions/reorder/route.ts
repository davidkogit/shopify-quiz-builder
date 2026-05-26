/**
 * Question Reorder — Bulk reorder questions within a quiz
 *
 * PUT /api/admin/questions/reorder — Reorder questions.
 * Body: { quizId: string, orderedIds: string[] }
 *
 * Validates session → store → quiz ownership, then verifies every
 * provided question ID belongs to the specified quiz. All updates
 * happen inside a single Prisma transaction.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";
import { reorderQuestions } from "../../../../../../lib/question-service";

// ---------------------------------------------------------------------------
// PUT — Reorder questions
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest): Promise<NextResponse> {
  // 1. Validate session → store
  const session = await getSessionFromCookie(req.cookies, env.SESSION_SECRET);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized — missing or invalid session" },
      { status: 401 },
    );
  }

  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // 2. Parse body
  let body: { quizId?: string; orderedIds?: string[] };
  try {
    body = (await req.json()) as { quizId?: string; orderedIds?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.quizId || !Array.isArray(body.orderedIds)) {
    return NextResponse.json(
      { error: "quizId (string) and orderedIds (string[]) are required" },
      { status: 400 },
    );
  }

  const { quizId, orderedIds } = body;

  if (orderedIds.length === 0) {
    return NextResponse.json(
      { error: "orderedIds must not be empty" },
      { status: 400 },
    );
  }

  // 3. Verify quiz ownership
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, storeId: true },
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  if (quiz.storeId !== store.id) {
    return NextResponse.json(
      { error: "Forbidden — quiz belongs to a different store" },
      { status: 403 },
    );
  }

  // 4. Verify all question IDs belong to this quiz
  const existingQuestions = await prisma.question.findMany({
    where: { quizId },
    select: { id: true },
  });
  const existingIds = new Set(existingQuestions.map((q) => q.id));

  for (const qid of orderedIds) {
    if (!existingIds.has(qid)) {
      return NextResponse.json(
        { error: `Question ${qid} not found in quiz ${quizId}` },
        { status: 400 },
      );
    }
  }

  // 5. Execute reorder inside a transaction
  try {
    await reorderQuestions(prisma, quizId, orderedIds);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to reorder questions" },
      { status: 500 },
    );
  }
}
