/**
 * Answer Service Module
 *
 * Pure CRUD functions for Answer records with explicit PrismaClient dependency.
 * Every database function accepts `prisma` as its first parameter so callers
 * control lifecycle and transaction scope (DI pattern matching lib/question-service.ts).
 *
 * Functions: createAnswer, getAnswer, getAnswers, updateAnswer, deleteAnswer,
 *            reorderAnswers
 */
import type { PrismaClient, Answer } from "@prisma/client";

// ---------------------------------------------------------------------------
// createAnswer
// ---------------------------------------------------------------------------

/** Fields accepted when creating an answer. */
export type CreateAnswerData = {
  title: string;
  image?: string;
  description?: string;
  order?: number;
  points?: number;
  tags?: string;
  leadsToQuestionId?: string;
  settings?: string;
};

/**
 * Insert a new answer into a question.
 *
 * Auto-assigns `order` by counting existing answers if not provided,
 * so the first answer gets order=0, second gets order=1, and so on.
 */
export async function createAnswer(
  prisma: PrismaClient,
  questionId: string,
  data: CreateAnswerData,
): Promise<Answer> {
  const order =
    data.order ??
    (await prisma.answer.count({ where: { questionId } }));

  return prisma.answer.create({
    data: {
      questionId,
      title: data.title,
      image: data.image,
      description: data.description,
      order,
      points: data.points ?? 0,
      tags: data.tags ?? "[]",
      leadsToQuestionId: data.leadsToQuestionId,
      settings: data.settings ?? "{}",
    },
  });
}

// ---------------------------------------------------------------------------
// getAnswer
// ---------------------------------------------------------------------------

/**
 * Fetch a single answer with its related logic-config records.
 * Returns `null` if the answer does not exist.
 */
export async function getAnswer(
  prisma: PrismaClient,
  answerId: string,
): Promise<Answer | null> {
  return prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      products: true,
      productWeights: true,
      resultLinks: true,
      resultPathAnswers: true,
    },
  });
}

// ---------------------------------------------------------------------------
// getAnswers
// ---------------------------------------------------------------------------

/**
 * List all answers for a question, ordered by `order` ASC.
 */
export async function getAnswers(
  prisma: PrismaClient,
  questionId: string,
): Promise<Answer[]> {
  return prisma.answer.findMany({
    where: { questionId },
    orderBy: { order: "asc" },
  });
}

// ---------------------------------------------------------------------------
// updateAnswer
// ---------------------------------------------------------------------------

/** Allowed fields for partial answer updates. */
type UpdateAnswerData = Partial<
  Pick<
    Answer,
    | "title"
    | "image"
    | "description"
    | "order"
    | "points"
    | "tags"
    | "leadsToQuestionId"
    | "settings"
  >
>;

/**
 * Partial update of an answer. Only provided fields are changed.
 */
export async function updateAnswer(
  prisma: PrismaClient,
  answerId: string,
  data: UpdateAnswerData,
): Promise<Answer> {
  return prisma.answer.update({ where: { id: answerId }, data });
}

// ---------------------------------------------------------------------------
// deleteAnswer
// ---------------------------------------------------------------------------

/**
 * Cascade-delete an answer and all related data inside a transaction.
 *
 * SQLite lacks FK enforcement, so cascade is manual (bottom-up order):
 * answer products → product weights → result links → path answers → answer.
 */
export async function deleteAnswer(
  prisma: PrismaClient,
  answerId: string,
): Promise<void> {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: { id: true },
  });
  if (!answer) return;

  await prisma.$transaction(async (tx) => {
    await tx.answerProduct.deleteMany({ where: { answerId } });
    await tx.answerProductWeight.deleteMany({ where: { answerId } });
    await tx.answerResultLink.deleteMany({ where: { answerId } });
    await tx.resultPathAnswer.deleteMany({ where: { answerId } });
    await tx.answer.delete({ where: { id: answerId } });
  });
}

// ---------------------------------------------------------------------------
// reorderAnswers
// ---------------------------------------------------------------------------

/**
 * Bulk-update the `order` field for a set of answers within a question.
 *
 * Accepts an array of answer IDs in their new desired order and assigns
 * `order = index` for each one sequentially inside a single transaction.
 */
export async function reorderAnswers(
  prisma: PrismaClient,
  questionId: string,
  orderedIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.answer.update({
        where: { id: orderedIds[i] },
        data: { order: i },
      });
    }
  });
}
