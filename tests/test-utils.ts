/**
 * Test utilities — Prisma client for the test database, seed helpers, and
 * cleanup functions. Each test suite creates its own scenario via helpers below.
 */
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Test Prisma singleton
// ---------------------------------------------------------------------------

let _testPrisma: PrismaClient | undefined;

/** Return a PrismaClient connected to the test database. Reused across tests. */
export function getTestPrisma(): PrismaClient {
  if (!_testPrisma) {
    _testPrisma = new PrismaClient();
  }
  return _testPrisma;
}

/** Disconnect the test Prisma client after all tests. */
export async function disconnectTestPrisma(): Promise<void> {
  if (_testPrisma) {
    await _testPrisma.$disconnect();
    _testPrisma = undefined;
  }
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Delete all quiz-related records in FK-safe order so that `beforeEach` can
 * start with a clean slate. Does NOT delete the Store record (reused).
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Order matters: children before parents
  await prisma.resultPathAnswer.deleteMany();
  await prisma.answerProduct.deleteMany();
  await prisma.answerProductWeight.deleteMany();
  await prisma.answerResultLink.deleteMany();
  await prisma.resultPath.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.result.deleteMany();
  await prisma.quiz.deleteMany();
}

// ---------------------------------------------------------------------------
// Seed: store (reused across all tests)
// ---------------------------------------------------------------------------

let _storeId: string | undefined;

export async function ensureStore(prisma: PrismaClient): Promise<string> {
  if (_storeId) return _storeId;
  const store = await prisma.store.create({
    data: {
      shopifyDomain: "test-store.myshopify.com",
      accessToken: "test-access-token",
      scopes: "read_products",
    },
  });
  _storeId = store.id;
  return _storeId;
}

// ---------------------------------------------------------------------------
// Seed helpers for specific logic-type scenarios
// ---------------------------------------------------------------------------

/** Create a minimal Quiz and return it. */
export async function seedQuiz(
  prisma: PrismaClient,
  overrides: {
    storeId: string;
    name?: string;
    key?: string;
    logicType?: string;
    productLimit?: number | null;
  },
) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return prisma.quiz.create({
    data: {
      storeId: overrides.storeId,
      name: overrides.name ?? "Test Quiz",
      key: overrides.key ?? `test-quiz-${suffix}`,
      logicType: overrides.logicType ?? "basic",
      productLimit: overrides.productLimit ?? null,
    },
  });
}

/** Create a Question. */
export async function seedQuestion(
  prisma: PrismaClient,
  quizId: string,
  overrides: { type?: string; order?: number; title?: string },
) {
  return prisma.question.create({
    data: {
      quizId,
      type: overrides.type ?? "radio",
      order: overrides.order ?? 0,
      title: overrides.title ?? "Test Question",
    },
  });
}

/** Create an Answer. */
export async function seedAnswer(
  prisma: PrismaClient,
  questionId: string,
  overrides: {
    title?: string;
    order?: number;
    points?: number;
    leadsToQuestionId?: string | null;
  },
) {
  return prisma.answer.create({
    data: {
      questionId,
      title: overrides.title ?? "Test Answer",
      order: overrides.order ?? 0,
      points: overrides.points ?? 0,
      leadsToQuestionId: overrides.leadsToQuestionId ?? null,
    },
  });
}

/** Create a Result. */
export async function seedResult(
  prisma: PrismaClient,
  quizId: string,
  overrides: {
    title?: string;
    order?: number;
    pointsFrom?: number | null;
    pointsTo?: number | null;
  },
) {
  return prisma.result.create({
    data: {
      quizId,
      title: overrides.title ?? "Test Result",
      order: overrides.order ?? 0,
      pointsFrom: overrides.pointsFrom ?? null,
      pointsTo: overrides.pointsTo ?? null,
    },
  });
}

// -- Basic Logic seeds --

export async function seedResultPath(
  prisma: PrismaClient,
  quizId: string,
  resultId: string,
  overrides: { logicOperator?: string; order?: number },
) {
  return prisma.resultPath.create({
    data: {
      quizId,
      resultId,
      logicOperator: overrides.logicOperator ?? "AND",
      order: overrides.order ?? 0,
    },
  });
}

export async function seedResultPathAnswer(
  prisma: PrismaClient,
  resultPathId: string,
  questionId: string,
  answerId: string,
) {
  return prisma.resultPathAnswer.create({
    data: { resultPathId, questionId, answerId },
  });
}

// -- Single Logic seeds --

export async function seedAnswerProduct(
  prisma: PrismaClient,
  answerId: string,
  shopifyProductId: string,
  variantId?: string | null,
) {
  return prisma.answerProduct.create({
    data: {
      answerId,
      shopifyProductId,
      shopifyVariantId: variantId ?? null,
    },
  });
}

// -- Product Weight Logic seeds --

export async function seedAnswerProductWeight(
  prisma: PrismaClient,
  answerId: string,
  shopifyProductId: string,
  weight?: number,
) {
  return prisma.answerProductWeight.create({
    data: {
      answerId,
      shopifyProductId,
      weight: weight ?? 1,
    },
  });
}

// -- Result Weight Logic seeds --

export async function seedAnswerResultLink(
  prisma: PrismaClient,
  answerId: string,
  resultId: string,
  points?: number,
) {
  return prisma.answerResultLink.create({
    data: {
      answerId,
      resultId,
      points: points ?? 1,
    },
  });
}

// ---------------------------------------------------------------------------
// Full scenario builders (composed helpers for common test setups)
// ---------------------------------------------------------------------------

/**
 * Create a quiz with N questions, each having M answers.
 * Returns: { quiz, questions[], answers: Answer[][] }
 */
export async function seedQuizWithQnA(
  prisma: PrismaClient,
  storeId: string,
  questionCount: number,
  answersPerQuestion: number,
  overrides: {
    quizLogicType?: string;
    productLimit?: number | null;
  } = {},
) {
  const quiz = await seedQuiz(prisma, {
    storeId,
    logicType: overrides.quizLogicType,
    productLimit: overrides.productLimit,
  });

  const questions: Awaited<ReturnType<typeof seedQuestion>>[] = [];
  const answers: Awaited<ReturnType<typeof seedAnswer>>[][] = [];

  for (let qi = 0; qi < questionCount; qi++) {
    const q = await seedQuestion(prisma, quiz.id, {
      order: qi,
      title: `Q${qi + 1}`,
    });
    questions.push(q);

    const qAnswers: Awaited<ReturnType<typeof seedAnswer>>[] = [];
    for (let ai = 0; ai < answersPerQuestion; ai++) {
      const a = await seedAnswer(prisma, q.id, {
        title: `Q${qi + 1}-A${ai + 1}`,
        order: ai,
      });
      qAnswers.push(a);
    }
    answers.push(qAnswers);
  }

  return { quiz, questions, answers };
}
