/**
 * Quiz from Template API
 *
 * POST /api/admin/quizzes/from-template
 *
 * Authenticated endpoint that creates a full quiz — questions, answers,
 * results, and logic config — from a named pre-built template in a single
 * database transaction.
 *
 * Body: { templateId: "skincare" | "coffee" | "supplement" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../lib/session";
import { getStore } from "../../../../../../lib/store";
import { env } from "../../../../../../lib/env";
import { prisma } from "../../../../../../lib/prisma";
import {
  createSkincareTemplate,
  createCoffeeTemplate,
  createSupplementTemplate,
  seedQuizFromTemplate,
} from "../../../../../../lib/quiz-templates";

// ---------------------------------------------------------------------------
// Resolver (same pattern as admin/quizzes/route.ts)
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
// Template registry
// ---------------------------------------------------------------------------

type TemplateId = "skincare" | "coffee" | "supplement";

const TEMPLATE_REGISTRY: Record<
  TemplateId,
  () => ReturnType<typeof createSkincareTemplate>
> = {
  skincare: createSkincareTemplate,
  coffee: createCoffeeTemplate,
  supplement: createSupplementTemplate,
};

// ---------------------------------------------------------------------------
// POST — Create quiz from a template
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await resolveStore(req);
  if (!result.ok) return result.response;

  let body: { templateId?: string };
  try {
    body = (await req.json()) as { templateId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const templateId = body.templateId as TemplateId | undefined;
  if (!templateId || !TEMPLATE_REGISTRY[templateId]) {
    return NextResponse.json(
      { error: "Invalid templateId. Must be one of: skincare, coffee, supplement" },
      { status: 400 },
    );
  }

  try {
    const template = TEMPLATE_REGISTRY[templateId]();
    const { quizId } = await seedQuizFromTemplate(
      prisma,
      result.storeId,
      template,
    );
    return NextResponse.json({ quiz: { id: quizId } }, { status: 201 });
  } catch (err) {
    console.error("Failed to create quiz from template:", err);
    return NextResponse.json(
      { error: "Failed to create quiz from template" },
      { status: 500 },
    );
  }
}
