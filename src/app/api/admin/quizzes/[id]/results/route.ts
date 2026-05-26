/**
 * GET /api/admin/quizzes/[id]/results — List quiz results (for picker dropdowns)
 *
 * Validates session → store → quiz ownership.
 * Returns a lightweight array of { id, title, order } for each Result.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";

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
        { error: "Unauthorized" },
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
// GET — List results for a quiz
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: quizId } = await params;

  const storeResult = await resolveStore(req);
  if (!storeResult.ok) return storeResult.response;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, storeId: true },
  });

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  if (quiz.storeId !== storeResult.storeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const results = await prisma.result.findMany({
      where: { quizId },
      select: { id: true, title: true, order: true },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 },
    );
  }
}
