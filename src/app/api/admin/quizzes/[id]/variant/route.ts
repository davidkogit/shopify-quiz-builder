/**
 * Quiz Variant API — A/B Test Variant Creation
 *
 * POST /api/admin/quizzes/[id]/variant — Creates a duplicate of the quiz
 * as an A/B test variant. Both quizzes share the same abTestId (UUID
 * generated on first variant creation). Variant gets status='draft' and
 * name='[Original Name] (Variant)'.
 *
 * Session validation → store resolution → quiz ownership check before
 * any data operation.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { generateQuizKey } from "../../../../../../../lib/quiz-service";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal question shape needed during duplication. */
interface QRow {
  id: string;
  quizId: string;
  type: string;
  order: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  image: string | null;
  required: boolean;
  settings: string;
  isDraft: boolean;
}

/** Minimal answer shape needed during duplication. */
interface ARow {
  id: string;
  questionId: string;
  title: string;
  image: string | null;
  description: string | null;
  order: number;
  points: number;
  tags: string;
  leadsToQuestionId: string | null;
  settings: string;
}

/** Minimal result shape needed during duplication. */
interface RRow {
  id: string;
  quizId: string;
  title: string;
  description: string | null;
  image: string | null;
  order: number;
  outcomeType: string;
  outcomeData: string;
  pointsFrom: number | null;
  pointsTo: number | null;
}

/** Minimal result path shape. */
interface RPRow {
  id: string;
  quizId: string;
  resultId: string;
  logicOperator: string;
  order: number;
}

// ---------------------------------------------------------------------------
// Resolve helpers (mirror pattern from [id]/route.ts)
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

async function resolveQuizOwnership(
  req: NextRequest,
  quizId: string,
): Promise<
  | { ok: true; storeId: string; quiz: { id: string; storeId: string; name: string; abTestId: string | null; store: { id: string } } }
  | { ok: false; response: NextResponse }
> {
  const storeResult = await resolveStore(req);
  if (!storeResult.ok) return storeResult;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      storeId: true,
      name: true,
      abTestId: true,
      store: { select: { id: true } },
    },
  });

  if (!quiz) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Quiz not found" }, { status: 404 }),
    };
  }
  if (quiz.storeId !== storeResult.storeId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — quiz belongs to a different store" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, storeId: storeResult.storeId, quiz };
}

// ---------------------------------------------------------------------------
// POST — Create A/B test variant by duplicating the quiz
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const result = await resolveQuizOwnership(req, id);
  if (!result.ok) return result.response;

  const sourceQuiz = result.quiz;

  // Generate abTestId (reuse existing or create new UUID)
  const abTestId = sourceQuiz.abTestId ?? crypto.randomUUID();

  try {
    const variant = await prisma.$transaction(async (tx) => {
      // ---------- 1. Fetch all source data ----------
      const questions = await tx.question.findMany({
        where: { quizId: sourceQuiz.id },
        orderBy: { order: "asc" },
      }) as unknown as QRow[];

      const questionIds = questions.map((q) => q.id);

      const answers = questionIds.length > 0
        ? await tx.answer.findMany({
            where: { questionId: { in: questionIds } },
            orderBy: { order: "asc" },
          }) as unknown as ARow[]
        : [];

      const results = await tx.result.findMany({
        where: { quizId: sourceQuiz.id },
        orderBy: { order: "asc" },
      }) as unknown as RRow[];

      const resultIds = results.map((r) => r.id);

      const resultPaths = resultIds.length > 0
        ? await tx.resultPath.findMany({
            where: { quizId: sourceQuiz.id },
            orderBy: { order: "asc" },
          }) as unknown as RPRow[]
        : [];

      // ---------- 2. Create variant quiz ----------
      const variantName = `${sourceQuiz.name} (Variant)`;
      const variantKey = generateQuizKey(variantName);

      const variantQuiz = await tx.quiz.create({
        data: {
          storeId: sourceQuiz.storeId,
          name: variantName,
          key: variantKey,
          status: "draft",
          logicType: "basic", // default; styles/settings copied below
          abTestId,
        },
      });

      // ---------- 3. Copy questions ----------
      const qIdMap = new Map<string, string>();
      for (const q of questions) {
        const newId = crypto.randomUUID();
        qIdMap.set(q.id, newId);
        await tx.question.create({
          data: {
            id: newId,
            quizId: variantQuiz.id,
            type: q.type,
            order: q.order,
            title: q.title,
            subtitle: q.subtitle,
            description: q.description,
            image: q.image,
            required: q.required,
            settings: q.settings,
            isDraft: q.isDraft,
          },
        });
      }

      // ---------- 4. Copy answers ----------
      const aIdMap = new Map<string, string>();
      for (const a of answers) {
        const newId = crypto.randomUUID();
        aIdMap.set(a.id, newId);
        const newQuestionId = qIdMap.get(a.questionId) ?? a.questionId;
        const newLeadsTo = a.leadsToQuestionId
          ? (qIdMap.get(a.leadsToQuestionId) ?? a.leadsToQuestionId)
          : null;
        await tx.answer.create({
          data: {
            id: newId,
            questionId: newQuestionId,
            title: a.title,
            image: a.image,
            description: a.description,
            order: a.order,
            points: a.points,
            tags: a.tags,
            leadsToQuestionId: newLeadsTo,
            settings: a.settings,
          },
        });
      }

      // ---------- 5. Copy answer-level links ----------
      const answerIds = Array.from(aIdMap.keys());
      if (answerIds.length > 0) {
        // Single logic: answerProduct
        const oldProducts = await tx.answerProduct.findMany({
          where: { answerId: { in: answerIds } },
        });
        if (oldProducts.length > 0) {
          await tx.answerProduct.createMany({
            data: oldProducts.map((p) => ({
              id: crypto.randomUUID(),
              answerId: aIdMap.get(p.answerId) ?? p.answerId,
              shopifyProductId: p.shopifyProductId,
              shopifyVariantId: p.shopifyVariantId,
            })),
          });
        }

        // ProductWeight logic: answerProductWeight
        const oldWeights = await tx.answerProductWeight.findMany({
          where: { answerId: { in: answerIds } },
        });
        if (oldWeights.length > 0) {
          await tx.answerProductWeight.createMany({
            data: oldWeights.map((w) => ({
              id: crypto.randomUUID(),
              answerId: aIdMap.get(w.answerId) ?? w.answerId,
              shopifyProductId: w.shopifyProductId,
              shopifyVariantId: w.shopifyVariantId,
              weight: w.weight,
            })),
          });
        }
      }

      // ---------- 6. Copy results ----------
      const rIdMap = new Map<string, string>();
      for (const r of results) {
        const newId = crypto.randomUUID();
        rIdMap.set(r.id, newId);
        await tx.result.create({
          data: {
            id: newId,
            quizId: variantQuiz.id,
            title: r.title,
            description: r.description,
            image: r.image,
            order: r.order,
            outcomeType: r.outcomeType,
            outcomeData: r.outcomeData,
            pointsFrom: r.pointsFrom,
            pointsTo: r.pointsTo,
          },
        });
      }

      // ---------- 7. Copy result paths + path answers ----------
      for (const rp of resultPaths) {
        const newRpId = crypto.randomUUID();
        const newResultId = rIdMap.get(rp.resultId) ?? rp.resultId;
        await tx.resultPath.create({
          data: {
            id: newRpId,
            quizId: variantQuiz.id,
            resultId: newResultId,
            logicOperator: rp.logicOperator,
            order: rp.order,
          },
        });

        // Copy path answers for this result path
        const oldPathAnswers = await tx.resultPathAnswer.findMany({
          where: { resultPathId: rp.id },
        });
        if (oldPathAnswers.length > 0) {
          await tx.resultPathAnswer.createMany({
            data: oldPathAnswers.map((pa) => ({
              id: crypto.randomUUID(),
              resultPathId: newRpId,
              questionId: qIdMap.get(pa.questionId) ?? pa.questionId,
              answerId: aIdMap.get(pa.answerId) ?? pa.answerId,
            })),
          });
        }
      }

      // ---------- 8. Copy result links (ResultWeight) ----------
      if (answerIds.length > 0) {
        const oldLinks = await tx.answerResultLink.findMany({
          where: { answerId: { in: answerIds } },
        });
        if (oldLinks.length > 0) {
          await tx.answerResultLink.createMany({
            data: oldLinks.map((l) => ({
              id: crypto.randomUUID(),
              answerId: aIdMap.get(l.answerId) ?? l.answerId,
              resultId: rIdMap.get(l.resultId) ?? l.resultId,
              points: l.points,
            })),
          });
        }
      }

      // ---------- 9. Set abTestId on source quiz if it didn't have one ----------
      if (!sourceQuiz.abTestId) {
        await tx.quiz.update({
          where: { id: sourceQuiz.id },
          data: { abTestId },
        });
      }

      return variantQuiz;
    });

    return NextResponse.json(
      {
        variant: {
          id: variant.id,
          name: variant.name,
          key: variant.key,
          abTestId: variant.abTestId,
        },
        abTestId,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create variant" },
      { status: 500 },
    );
  }
}
