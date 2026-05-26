/**
 * DELETE /api/admin/answer-products/[id] — Unlink a product from an answer
 *
 * Validates: session → store → answer ownership via AnswerProduct relation.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";

// ---------------------------------------------------------------------------
// DELETE — Remove product link
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

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

  // --- Ownership via AnswerProduct → Answer → Question → Quiz → Store ---
  const link = await prisma.answerProduct.findUnique({
    where: { id },
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
    return NextResponse.json(
      { error: "Product link not found" },
      { status: 404 },
    );
  }
  if (link.answer.question.quiz.storeId !== store.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Delete ---
  try {
    await prisma.answerProduct.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to unlink product" },
      { status: 500 },
    );
  }
}
