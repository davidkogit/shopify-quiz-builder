/**
 * POST /api/admin/quizzes/[id]/result-paths — Create a new ResultPath
 *
 * Body: { resultId: string; logicOperator?: "AND" | "OR" }
 * Validates: session → store → quiz ownership.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";

// ---------------------------------------------------------------------------
// POST — Create a new result path
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: quizId } = await params;

  // --- Session ---
  const session = await getSessionFromCookie(req.cookies, env.SESSION_SECRET);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Store ---
  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // --- Quiz ownership ---
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, storeId: true },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  if (quiz.storeId !== store.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Parse body ---
  let body: { resultId?: string; logicOperator?: string };
  try {
    body = (await req.json()) as { resultId?: string; logicOperator?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.resultId) {
    return NextResponse.json(
      { error: "resultId is required" },
      { status: 400 },
    );
  }

  // Validate result belongs to this quiz
  const result = await prisma.result.findUnique({
    where: { id: body.resultId },
    select: { quizId: true },
  });
  if (!result || result.quizId !== quizId) {
    return NextResponse.json(
      { error: "Result not found for this quiz" },
      { status: 400 },
    );
  }

  // Determine next order value
  const maxOrder = await prisma.resultPath.findFirst({
    where: { quizId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (maxOrder?.order ?? -1) + 1;

  try {
    const path = await prisma.resultPath.create({
      data: {
        quizId,
        resultId: body.resultId,
        logicOperator: body.logicOperator === "OR" ? "OR" : "AND",
        order: nextOrder,
      },
      include: { pathAnswers: true, result: true },
    });
    return NextResponse.json({ path }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create result path" },
      { status: 500 },
    );
  }
}
