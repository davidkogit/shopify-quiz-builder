/**
 * Question Service Module
 *
 * Pure CRUD functions for Question records with explicit PrismaClient dependency.
 * Every database function accepts `prisma` as its first parameter so callers
 * control lifecycle and transaction scope (DI pattern matching lib/quiz-service.ts).
 *
 * Functions: createQuestion, getQuestion, getQuestions, updateQuestion,
 *            deleteQuestion, reorderQuestions
 */
import type { PrismaClient, Question } from "@prisma/client";

// ---------------------------------------------------------------------------
// createQuestion
// ---------------------------------------------------------------------------

/** Fields accepted when creating a question. */
export type CreateQuestionData = {
  type: string;
  title: string;
  order?: number;
};

/**
 * Insert a new question into a quiz.
 *
 * Auto-assigns `order` by counting existing questions if not provided,
 * so the first question gets order=0, second gets order=1, and so on.
 */
export async function createQuestion(
  prisma: PrismaClient,
  quizId: string,
  data: CreateQuestionData,
): Promise<Question> {
  const order =
    data.order ??
    (await prisma.question.count({ where: { quizId } }));

  return prisma.question.create({
    data: { quizId, type: data.type, title: data.title, order },
  });
}

// ---------------------------------------------------------------------------
// getQuestion
// ---------------------------------------------------------------------------

/**
 * Fetch a single question with its answers included, ordered by `order` ASC.
 * Returns `null` if the question does not exist.
 */
export async function getQuestion(
  prisma: PrismaClient,
  questionId: string,
): Promise<Question | null> {
  return prisma.question.findUnique({
    where: { id: questionId },
    include: { answers: { orderBy: { order: "asc" } } },
  });
}

// ---------------------------------------------------------------------------
// getQuestions
// ---------------------------------------------------------------------------

/**
 * List all questions for a quiz, each including its answers,
 * ordered by the question `order` field ASC.
 */
export async function getQuestions(
  prisma: PrismaClient,
  quizId: string,
): Promise<Question[]> {
  return prisma.question.findMany({
    where: { quizId },
    include: { answers: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
}

// ---------------------------------------------------------------------------
// updateQuestion
// ---------------------------------------------------------------------------

/** Allowed fields for partial question updates. */
type UpdateQuestionData = Partial<
  Pick<
    Question,
    | "type"
    | "order"
    | "title"
    | "subtitle"
    | "description"
    | "image"
    | "required"
    | "settings"
    | "isDraft"
  >
>;

/**
 * Partial update of a question. Only provided fields are changed.
 */
export async function updateQuestion(
  prisma: PrismaClient,
  questionId: string,
  data: UpdateQuestionData,
): Promise<Question> {
  return prisma.question.update({ where: { id: questionId }, data });
}

// ---------------------------------------------------------------------------
// deleteQuestion
// ---------------------------------------------------------------------------

/**
 * Cascade-delete a question and all related data inside a transaction.
 *
 * SQLite lacks FK enforcement, so cascade is manual (bottom-up order):
 * answer products/weights/links → result-path answers → answers → question.
 */
export async function deleteQuestion(
  prisma: PrismaClient,
  questionId: string,
): Promise<void> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) return;

  await prisma.$transaction(async (tx) => {
    const answerIds = (
      await tx.answer.findMany({
        where: { questionId },
        select: { id: true },
      })
    ).map((a) => a.id);

    // Clean up answer-level relations first
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

    // Clean up result-path answers referencing this question directly
    await tx.resultPathAnswer.deleteMany({ where: { questionId } });

    // Finally delete the question
    await tx.question.delete({ where: { id: questionId } });
  });
}

// ---------------------------------------------------------------------------
// reorderQuestions
// ---------------------------------------------------------------------------

/**
 * Bulk-update the `order` field for a set of questions within a quiz.
 *
 * Accepts an array of question IDs in their new desired order and assigns
 * `order = index` for each one sequentially inside a single transaction.
 */
export async function reorderQuestions(
  prisma: PrismaClient,
  quizId: string,
  orderedIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.question.update({
        where: { id: orderedIds[i] },
        data: { order: i },
      });
    }
  });
}
