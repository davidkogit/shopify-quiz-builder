/**
 * PUT    /api/admin/answer-result-links/[id] — Update points for a result link
 * DELETE /api/admin/answer-result-links/[id] — Remove a result link
 *
 * Validates: session → store → ownership via AnswerResultLink → Answer →
 * Question → Quiz → Store chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveOwnership(
  req: NextRequest,
  linkId: string,
): Promise<
  | { ok: true; linkId: string }
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

  const link = await prisma.answerResultLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      answer: {
        select: {
          question: { select: { quiz: { select: { storeId: true } } } },
        },
      },
    },
  });

  if (!link) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Result link not found" },
        { status: 404 },
      ),
    };
  }
  if (link.answer.question.quiz.storeId !== store.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, linkId: link.id };
}

// ---------------------------------------------------------------------------
// PUT — Update points
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const auth = await resolveOwnership(req, id);
  if (!auth.ok) return auth.response;

  let body: { points?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.points == null || typeof body.points !== "number" || body.points < 0) {
    return NextResponse.json(
      { error: "points must be a non-negative number" },
      { status: 400 },
    );
  }

  try {
    const resultLink = await prisma.answerResultLink.update({
      where: { id: auth.linkId },
      data: { points: body.points },
    });
    return NextResponse.json({ resultLink });
  } catch {
    return NextResponse.json(
      { error: "Failed to update result link" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove result link
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const auth = await resolveOwnership(req, id);
  if (!auth.ok) return auth.response;

  try {
    await prisma.answerResultLink.delete({ where: { id: auth.linkId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete result link" },
      { status: 500 },
    );
  }
}
