/**
 * POST /api/admin/answers/[id]/products — Link a Shopify product to an answer
 *
 * Requires: session → store → answer ownership validation.
 * Body: { shopifyProductId: string (GID), shopifyVariantId?: string }
 * Response: { answerProduct: { id, answerId, shopifyProductId, shopifyVariantId } }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveAuth(
  req: NextRequest,
  answerId: string,
): Promise<
  | { ok: true; answerId: string }
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

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      question: { select: { quiz: { select: { storeId: true } } } },
    },
  });

  if (!answer) {
    return { ok: false, response: NextResponse.json({ error: "Answer not found" }, { status: 404 }) };
  }
  if (answer.question.quiz.storeId !== store.id) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, answerId: answer.id };
}

// ---------------------------------------------------------------------------
// POST — Link product to answer
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const auth = await resolveAuth(req, id);
  if (!auth.ok) return auth.response;

  let body: { shopifyProductId?: string; shopifyVariantId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.shopifyProductId || typeof body.shopifyProductId !== "string") {
    return NextResponse.json(
      { error: "shopifyProductId is required" },
      { status: 400 },
    );
  }

  try {
    const answerProduct = await prisma.answerProduct.create({
      data: {
        answerId: auth.answerId,
        shopifyProductId: body.shopifyProductId,
        shopifyVariantId: body.shopifyVariantId ?? null,
      },
    });
    return NextResponse.json({ answerProduct }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to link product" },
      { status: 500 },
    );
  }
}
