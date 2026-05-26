/**
 * Public Quiz Config API
 *
 * GET /api/public/quiz/[key] — Fetch published quiz configuration for the
 * storefront widget. No Shopify session required — key-based access.
 *
 * Returns quiz name, questions (with answers), results, styles, and settings.
 * Internal IDs (storeId), access tokens, and sensitive data are never exposed.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { rateLimit, getClientIp } from "../../../../../../lib/rate-limit";
import { safeJsonParse } from "../../../../../../lib/json-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a published quiz by its public key. Returns null if not found or not published. */
async function findPublicQuiz(key: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { key },
    include: {
      questions: { include: { answers: true }, orderBy: { order: "asc" } },
      results: { orderBy: { order: "asc" } },
    },
  });
  if (!quiz || quiz.status !== "published") return null;
  return quiz;
}

/** Map a full quiz record to the public-facing response shape. */
function toPublicQuiz(
  quiz: NonNullable<Awaited<ReturnType<typeof findPublicQuiz>>>,
) {
  const settings = safeJsonParse(quiz.settings, {} as Record<string, unknown>);
  return {
    id: quiz.id,
    name: quiz.name,
    key: quiz.key,
    logicType: quiz.logicType,
    settings,
    discountCode: (settings.discountCode as string) ?? null,
    discountLabel: (settings.discountLabel as string) ?? null,
    styles: safeJsonParse(quiz.styles, {}),
    questions: quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      order: q.order,
      title: q.title,
      subtitle: q.subtitle,
      description: q.description,
      image: q.image,
      required: q.required,
      settings: safeJsonParse(q.settings, {}),
      answers: q.answers.map((a) => ({
        id: a.id,
        title: a.title,
        image: a.image,
        description: a.description,
        order: a.order,
        points: a.points,
        tags: safeJsonParse(a.tags, {}),
        leadsToQuestionId: a.leadsToQuestionId,
      })),
    })),
    results: quiz.results.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      image: r.image,
      order: r.order,
      outcomeType: r.outcomeType,
      outcomeData: safeJsonParse(r.outcomeData, {}),
      pointsFrom: r.pointsFrom,
      pointsTo: r.pointsTo,
    })),
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  // Rate limit: 60 requests per minute per IP
  const clientIp = getClientIp(_req);
  const limitKey = `quiz:get:${clientIp}`;
  const { allowed } = rateLimit(limitKey, 60, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  try {
    const { key } = await params;
    const quiz = await findPublicQuiz(key);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    return NextResponse.json({ quiz: toPublicQuiz(quiz) });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 },
    );
  }
}
