/**
 * PUT /api/admin/result-paths/[id] — Update path operator or answer mappings
 * DELETE /api/admin/result-paths/[id] — Delete a result path (cascades answers)
 *
 * PUT body: { logicOperator?: "AND" | "OR"; answers?: { questionId: string; answerId: string }[] }
 *
 * Validates: session → store → ResultPath ownership (via Quiz → Store).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";

// ---------------------------------------------------------------------------
// Helpers — ownership verification via ResultPath → Quiz → Store
// ---------------------------------------------------------------------------

async function resolvePathOwnership(
  pathId: string,
  storeId: string,
): Promise<{ ok: true; quizId: string } | { ok: false; response: NextResponse }> {
  const path = await prisma.resultPath.findUnique({
    where: { id: pathId },
    select: {
      id: true,
      quiz: { select: { storeId: true, id: true } },
    },
  });
  if (!path) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Path not found" }, { status: 404 }),
    };
  }
  if (path.quiz.storeId !== storeId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, quizId: path.quiz.id };
}

// ---------------------------------------------------------------------------
// Shared auth guard
// ---------------------------------------------------------------------------

async function guard(
  req: NextRequest,
  pathId: string,
): Promise<
  | { ok: true; quizId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromCookie(req.cookies, env.SESSION_SECRET);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Store not found" }, { status: 404 }),
    };
  }
  return resolvePathOwnership(pathId, store.id);
}

// ---------------------------------------------------------------------------
// PUT — Update path operator and/or answer set
// ---------------------------------------------------------------------------

interface PutBody {
  logicOperator?: string;
  answers?: { questionId: string; answerId: string }[];
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const g = await guard(req, id);
  if (!g.ok) return g.response;

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (
    body.logicOperator === "AND" ||
    body.logicOperator === "OR"
  ) {
    updateData.logicOperator = body.logicOperator;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update operator if provided
      if (Object.keys(updateData).length > 0) {
        await tx.resultPath.update({ where: { id }, data: updateData });
      }

      // Replace answer set if provided
      if (Array.isArray(body.answers)) {
        // Validate all answer IDs belong to the quiz's questions
        const questionIds = [...new Set(body.answers.map((a) => a.questionId))];
        const validQuestions = await tx.question.findMany({
          where: { id: { in: questionIds }, quizId: g.quizId },
          select: { id: true },
        });
        const validIds = new Set(validQuestions.map((q) => q.id));
        const answerIds = body.answers.map((a) => a.answerId);
        const validAnswers = await tx.answer.findMany({
          where: {
            id: { in: answerIds },
            questionId: { in: [...validIds] },
          },
          select: { id: true, questionId: true },
        });

        // Build a map of valid (questionId, answerId) pairs
        const validPairs = new Set(
          validAnswers.map((a) => `${a.questionId}:${a.id}`),
        );

        // Delete existing path answers and recreate from valid input
        await tx.resultPathAnswer.deleteMany({ where: { resultPathId: id } });

        const toCreate = body.answers
          .filter((a) => validPairs.has(`${a.questionId}:${a.answerId}`))
          .map((a) => ({
            resultPathId: id,
            questionId: a.questionId,
            answerId: a.answerId,
          }));

        if (toCreate.length > 0) {
          await tx.resultPathAnswer.createMany({ data: toCreate });
        }
      }
    });

    // Fetch updated path
    const updated = await prisma.resultPath.findUnique({
      where: { id },
      include: { pathAnswers: true, result: true },
    });

    return NextResponse.json({ path: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update result path" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete a result path (cascades pathAnswers)
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const g = await guard(req, id);
  if (!g.ok) return g.response;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.resultPathAnswer.deleteMany({ where: { resultPathId: id } });
      await tx.resultPath.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete result path" },
      { status: 500 },
    );
  }
}
