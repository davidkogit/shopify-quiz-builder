/**
 * Quiz Service Module
 *
 * Pure CRUD functions for Quiz records with explicit PrismaClient dependency.
 * Every database function accepts `prisma` as its first parameter so callers
 * control lifecycle and transaction scope (DI pattern matching lib/store.ts).
 *
 * Functions: generateQuizKey (pure), createQuiz, getQuizzes, getQuizFull,
 *            updateQuiz, deleteQuiz, publishQuiz, unpublishQuiz, duplicateQuiz
 */
import type { PrismaClient, Quiz } from "@prisma/client";

// ---------------------------------------------------------------------------
// generateQuizKey — pure helper, zero dependencies
// ---------------------------------------------------------------------------

/** Generate a URL-safe slug from a quiz name with a random suffix. Pure function. */
export function generateQuizKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${slug}-${suffix}`;
}

// ---------------------------------------------------------------------------
// createQuiz
// ---------------------------------------------------------------------------

/**
 * Insert a new quiz with an auto-generated unique key.
 * Schema defaults supply: status="draft", settings="{}", styles="{}".
 */
export async function createQuiz(
  prisma: PrismaClient,
  storeId: string,
  name: string,
  logicType = "basic",
): Promise<Quiz> {
  const key = generateQuizKey(name);
  return prisma.quiz.create({ data: { storeId, name, key, logicType } });
}

// ---------------------------------------------------------------------------
// getQuizzes
// ---------------------------------------------------------------------------

/** List all quizzes for a store (summary, no relations), ordered by updatedAt desc. */
export async function getQuizzes(
  prisma: PrismaClient,
  storeId: string,
): Promise<Quiz[]> {
  return prisma.quiz.findMany({
    where: { storeId },
    orderBy: { updatedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// getQuizFull
// ---------------------------------------------------------------------------

/** Fetch quiz with questions (and answers) + results + resultPaths. Returns null if not found. */
export async function getQuizFull(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        include: { answers: true },
        orderBy: { order: "asc" },
      },
      results: {
        orderBy: { order: "asc" },
      },
      resultPaths: {
        include: { pathAnswers: true, result: true },
        orderBy: { order: "asc" },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// updateQuiz
// ---------------------------------------------------------------------------

/** Allowed fields for partial quiz metadata updates. */
type UpdateQuizData = Partial<
  Pick<Quiz, "name" | "settings" | "styles" | "logicType" | "productLimit">
>;

/** Partial update of quiz metadata. Only provided fields are changed. */
export async function updateQuiz(
  prisma: PrismaClient,
  id: string,
  data: UpdateQuizData,
): Promise<Quiz> {
  return prisma.quiz.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// deleteQuiz
// ---------------------------------------------------------------------------

/**
 * Cascade-delete a quiz and all related data inside a transaction.
 * SQLite lacks FK enforcement so cascade is manual (bottom-up order):
 * answer links → answers → questions → result links → results → paths →
 * submissions → events → quiz.
 */
export async function deleteQuiz(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!quiz) return;

  await prisma.$transaction(async (tx) => {
    const quizId = quiz.id;
    // Collect dependent record IDs
    const questionIds = (
      await tx.question.findMany({ where: { quizId }, select: { id: true } })
    ).map((q) => q.id);

    const answerIds =
      questionIds.length > 0
        ? (
            await tx.answer.findMany({
              where: { questionId: { in: questionIds } },
              select: { id: true },
            })
          ).map((a) => a.id)
        : [];

    const resultIds = (
      await tx.result.findMany({ where: { quizId }, select: { id: true } })
    ).map((r) => r.id);
    // Delete bottom-up: children first, then parents
    if (answerIds.length > 0) {
      await tx.answerProduct.deleteMany({
        where: { answerId: { in: answerIds } },
      });
      await tx.answerProductWeight.deleteMany({
        where: { answerId: { in: answerIds } },
      });
      await tx.answerResultLink.deleteMany({
        where: { answerId: { in: answerIds } },
      });
      await tx.resultPathAnswer.deleteMany({
        where: { answerId: { in: answerIds } },
      });
      await tx.answer.deleteMany({ where: { id: { in: answerIds } } });
    }

    if (resultIds.length > 0) {
      await tx.answerResultLink.deleteMany({
        where: { resultId: { in: resultIds } },
      });
      await tx.result.deleteMany({ where: { id: { in: resultIds } } });
    }

    await tx.resultPath.deleteMany({ where: { quizId } });

    if (questionIds.length > 0) {
      await tx.question.deleteMany({ where: { id: { in: questionIds } } });
    }

    await tx.analyticsEvent.deleteMany({ where: { quizId } });
    await tx.submission.deleteMany({ where: { quizId } });
    await tx.quiz.delete({ where: { id: quizId } });
  });
}

// ---------------------------------------------------------------------------
// publishQuiz / unpublishQuiz
// ---------------------------------------------------------------------------

/** Set quiz status to "published". */
export async function publishQuiz(
  prisma: PrismaClient,
  id: string,
): Promise<Quiz> {
  return prisma.quiz.update({
    where: { id },
    data: { status: "published" },
  });
}

/** Set quiz status back to "draft". */
export async function unpublishQuiz(
  prisma: PrismaClient,
  id: string,
): Promise<Quiz> {
  return prisma.quiz.update({ where: { id }, data: { status: "draft" } });
}

// ---------------------------------------------------------------------------
// duplicateQuiz — deep-copy a quiz with all nested configs
// ---------------------------------------------------------------------------

/** Shape of a quiz fetched with all relations needed for duplication. */
type DuplicateSource = NonNullable<
  Awaited<ReturnType<typeof fetchQuizForDuplicate>>
>;

/**
 * Fetch a quiz with every nested relation required for a faithful deep copy.
 * Not exported — only used internally by {@link duplicateQuiz}.
 */
async function fetchQuizForDuplicate(prisma: PrismaClient, quizId: string) {
  return prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          answers: {
            include: { products: true, productWeights: true, resultLinks: true },
          },
        },
        orderBy: { order: "asc" },
      },
      results: { orderBy: { order: "asc" } },
      resultPaths: {
        include: { pathAnswers: true },
        orderBy: { order: "asc" },
      },
    },
  });
}

/**
 * Deep-copy a quiz inside a Prisma transaction.
 *
 * Copies the quiz record, all questions, answers, results, result paths,
 * and every associated logic configuration (answer products, weights,
 * result links, path answers). The copy receives a new unique key, a
 * `"[Name] (Copy)"` suffix, and `status = "draft"`.
 *
 * @param prisma  - The PrismaClient instance (DI).
 * @param quizId  - ID of the source quiz to duplicate.
 * @param newName - Optional custom name for the copy (defaults to
 *                  `"[Original Name] (Copy)"`).
 * @returns The newly created Quiz record.
 */
export async function duplicateQuiz(
  prisma: PrismaClient,
  quizId: string,
  newName?: string,
): Promise<Quiz> {
  const source = await fetchQuizForDuplicate(prisma, quizId);
  if (!source) throw new Error(`Quiz not found: ${quizId}`);

  const name = newName ?? `${source.name} (Copy)`;
  const key = generateQuizKey(name);

  return prisma.$transaction(async (tx) => {
    // 1. Create the new quiz record (always draft)
    const newQuiz = await tx.quiz.create({
      data: {
        storeId: source.storeId,
        name,
        key,
        status: "draft",
        logicType: source.logicType,
        settings: source.settings,
        styles: source.styles,
        productLimit: source.productLimit,
      },
    });

    // 2. Copy questions → track old→new ID mapping
    const qMap = new Map<string, string>();
    for (const q of source.questions) {
      const created = await tx.question.create({
        data: {
          quizId: newQuiz.id,
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
      qMap.set(q.id, created.id);
    }

    // 3. Copy answers → track old→new ID mapping
    const aMap = new Map<string, string>();
    for (const q of source.questions) {
      for (const a of q.answers) {
        const created = await tx.answer.create({
          data: {
            questionId: qMap.get(a.questionId)!,
            title: a.title,
            image: a.image,
            description: a.description,
            order: a.order,
            points: a.points,
            tags: a.tags,
            leadsToQuestionId: a.leadsToQuestionId
              ? (qMap.get(a.leadsToQuestionId) ?? null)
              : null,
            settings: a.settings,
          },
        });
        aMap.set(a.id, created.id);
      }
    }

    // 4. Copy answer sub-relations (products, weights)
    for (const q of source.questions) {
      for (const a of q.answers) {
        const newAId = aMap.get(a.id)!;
        for (const ap of a.products) {
          await tx.answerProduct.create({
            data: {
              answerId: newAId,
              shopifyProductId: ap.shopifyProductId,
              shopifyVariantId: ap.shopifyVariantId,
            },
          });
        }
        for (const apw of a.productWeights) {
          await tx.answerProductWeight.create({
            data: {
              answerId: newAId,
              shopifyProductId: apw.shopifyProductId,
              shopifyVariantId: apw.shopifyVariantId,
              weight: apw.weight,
            },
          });
        }
      }
    }

    // 5. Copy results → track old→new ID mapping
    const rMap = new Map<string, string>();
    for (const r of source.results) {
      const created = await tx.result.create({
        data: {
          quizId: newQuiz.id,
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
      rMap.set(r.id, created.id);
    }

    // 6. Copy answer-result links (needs both aMap and rMap populated)
    for (const q of source.questions) {
      for (const a of q.answers) {
        for (const arl of a.resultLinks) {
          await tx.answerResultLink.create({
            data: {
              answerId: aMap.get(a.id)!,
              resultId: rMap.get(arl.resultId)!,
              points: arl.points,
            },
          });
        }
      }
    }

    // 7. Copy result paths → track old→new ID mapping
    const pMap = new Map<string, string>();
    for (const rp of source.resultPaths) {
      const created = await tx.resultPath.create({
        data: {
          quizId: newQuiz.id,
          resultId: rMap.get(rp.resultId)!,
          logicOperator: rp.logicOperator,
          order: rp.order,
        },
      });
      pMap.set(rp.id, created.id);
    }

    // 8. Copy result-path answers
    for (const rp of source.resultPaths) {
      for (const rpa of rp.pathAnswers) {
        await tx.resultPathAnswer.create({
          data: {
            resultPathId: pMap.get(rp.id)!,
            questionId: qMap.get(rpa.questionId)!,
            answerId: aMap.get(rpa.answerId)!,
          },
        });
      }
    }

    return newQuiz;
  });
}
