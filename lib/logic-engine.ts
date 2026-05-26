/**
 * Logic Engine — Quiz recommendation algorithms.
 *
 * All 6 logic types plus logic-jump resolution. Every function accepts
 * PrismaClient as first parameter (DI pattern), is pure, and under 50 LOC
 * (excluding JSDoc / blank lines).
 *
 * @see /workspace/plans/2026-05-18-quiz-kit-replication-plan.md — Core Algorithms
 */
import type {
  PrismaClient,
  Result,
  Question,
  ResultPathAnswer,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** A single user-submitted answer aggregation: one question → selected answer IDs. */
export type UserAnswer = {
  questionId: string;
  answerIds: string[];
};

/** Weighted product result from Product Weight logic. */
export type WeightedProduct = {
  shopifyProductId: string;
  score: number;
};

// ---------------------------------------------------------------------------
// Internal helpers (not exported — implementation detail)
// ---------------------------------------------------------------------------

/** Build a Map<questionId, Set<answerId>> for O(1) membership checks. */
function buildAnswerMap(userAnswers: UserAnswer[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const ua of userAnswers) {
    map.set(ua.questionId, new Set(ua.answerIds));
  }
  return map;
}

/** Extract a flat array of all selected answer IDs across all questions. */
function flatAnswerIds(userAnswers: UserAnswer[]): string[] {
  return userAnswers.flatMap((ua) => ua.answerIds);
}

// ---------------------------------------------------------------------------
// 1. evaluateBasicLogic — Path-based matching (AND / OR)
// ---------------------------------------------------------------------------

/** Check AND path: every pathAnswer must be selected by the user. */
function evaluateAnd(
  pathAnswers: ResultPathAnswer[],
  answerMap: Map<string, Set<string>>,
): boolean {
  if (pathAnswers.length === 0) return false;
  for (const pa of pathAnswers) {
    const selected = answerMap.get(pa.questionId);
    if (!selected || !selected.has(pa.answerId)) return false;
  }
  return true;
}

/** Check OR path: at least one pathAnswer must be selected by the user. */
function evaluateOr(
  pathAnswers: ResultPathAnswer[],
  answerMap: Map<string, Set<string>>,
): boolean {
  if (pathAnswers.length === 0) return false;
  for (const pa of pathAnswers) {
    const selected = answerMap.get(pa.questionId);
    if (selected && selected.has(pa.answerId)) return true;
  }
  return false;
}

/**
 * Evaluates user answers against configured ResultPaths.
 *
 * Fetches all paths for the quiz. For each path, applies AND or OR logic
 * against the user's answer set. Returns the first matching path's Result,
 * or `null` when no path matches.
 *
 * Edge cases: empty paths → false; empty userAnswers → no match → null.
 */
export async function evaluateBasicLogic(
  prisma: PrismaClient,
  quizId: string,
  userAnswers: UserAnswer[],
): Promise<Result | null> {
  const paths = await prisma.resultPath.findMany({
    where: { quizId },
    include: { pathAnswers: true, result: true },
    orderBy: { order: "asc" },
  });
  if (paths.length === 0) return null;

  const answerMap = buildAnswerMap(userAnswers);

  for (const path of paths) {
    const matched =
      path.logicOperator === "AND"
        ? evaluateAnd(path.pathAnswers, answerMap)
        : evaluateOr(path.pathAnswers, answerMap);

    if (matched) return path.result;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 2. evaluateSingleLogic — Answer → Product direct mapping
// ---------------------------------------------------------------------------

/**
 * Collects shopifyProductIds linked to selected answers via AnswerProduct.
 *
 * For every selected answer ID, fetches linked AnswerProduct records,
 * deduplicates shopifyProductIds, and applies the quiz's productLimit if set.
 *
 * Edge cases: no answers selected → empty array; no linked products → empty.
 */
export async function evaluateSingleLogic(
  prisma: PrismaClient,
  quizId: string,
  userAnswers: UserAnswer[],
): Promise<{ productIds: string[] }> {
  const answerIds = flatAnswerIds(userAnswers);
  if (answerIds.length === 0) return { productIds: [] };

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { productLimit: true },
  });

  const records = await prisma.answerProduct.findMany({
    where: { answerId: { in: answerIds } },
    select: { shopifyProductId: true },
  });

  let productIds = [...new Set(records.map((r) => r.shopifyProductId))];

  if (quiz?.productLimit != null && productIds.length > quiz.productLimit) {
    productIds = productIds.slice(0, quiz.productLimit);
  }

  return { productIds };
}

// ---------------------------------------------------------------------------
// 3. evaluatePointsLogic — Score range matching
// ---------------------------------------------------------------------------

/**
 * Sums the `points` field of every selected answer and finds the Result
 * whose `pointsFrom <= totalPoints <= pointsTo` range contains the sum.
 *
 * Returns the first matching Result (by order) or null.
 *
 * Edge cases: no answers selected → null; no range match → null.
 */
export async function evaluatePointsLogic(
  prisma: PrismaClient,
  quizId: string,
  userAnswers: UserAnswer[],
): Promise<Result | null> {
  const answerIds = flatAnswerIds(userAnswers);
  if (answerIds.length === 0) return null;

  const answers = await prisma.answer.findMany({
    where: { id: { in: answerIds } },
    select: { points: true },
  });

  const totalPoints = answers.reduce((sum, a) => sum + a.points, 0);

  const results = await prisma.result.findMany({
    where: {
      quizId,
      pointsFrom: { lte: totalPoints },
      pointsTo: { gte: totalPoints },
    },
    orderBy: { order: "asc" },
  });

  return results[0] ?? null;
}

// ---------------------------------------------------------------------------
// 4. evaluateProductWeightLogic — Accumulated product scoring
// ---------------------------------------------------------------------------

/**
 * Accumulates product weights from AnswerProductWeight records.
 *
 * Each selected answer contributes its weight to linked products.
 * Results are sorted by score descending and limited by quiz.productLimit.
 *
 * Edge cases: no answers → []; no weights → [].
 */
export async function evaluateProductWeightLogic(
  prisma: PrismaClient,
  quizId: string,
  userAnswers: UserAnswer[],
): Promise<WeightedProduct[]> {
  const answerIds = flatAnswerIds(userAnswers);
  if (answerIds.length === 0) return [];

  const rows = await prisma.answerProductWeight.findMany({
    where: { answerId: { in: answerIds } },
    select: { shopifyProductId: true, weight: true },
  });

  const scoreMap = new Map<string, number>();
  for (const row of rows) {
    scoreMap.set(
      row.shopifyProductId,
      (scoreMap.get(row.shopifyProductId) ?? 0) + row.weight,
    );
  }

  let sorted: WeightedProduct[] = [...scoreMap.entries()]
    .map(([shopifyProductId, score]) => ({ shopifyProductId, score }))
    .sort((a, b) => b.score - a.score);

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { productLimit: true },
  });

  if (quiz?.productLimit != null && sorted.length > quiz.productLimit) {
    sorted = sorted.slice(0, quiz.productLimit);
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// 5. evaluateResultWeightLogic — Accumulated result scoring
// ---------------------------------------------------------------------------

/**
 * Accumulates result points from AnswerResultLink records.
 *
 * Each selected answer contributes points to linked results. The result
 * with the highest accumulated score wins. Ties resolve to the first
 * result by `order`.
 *
 * Returns the winning Result, or null if no links exist.
 *
 * Edge cases: no links → null; ties → first by order; all-zero scores → first.
 */
export async function evaluateResultWeightLogic(
  prisma: PrismaClient,
  quizId: string,
  userAnswers: UserAnswer[],
): Promise<Result | null> {
  const answerIds = flatAnswerIds(userAnswers);
  if (answerIds.length === 0) return null;

  const links = await prisma.answerResultLink.findMany({
    where: { answerId: { in: answerIds } },
    select: { resultId: true, points: true },
  });

  if (links.length === 0) return null;

  const scoreMap = new Map<string, number>();
  for (const link of links) {
    scoreMap.set(link.resultId, (scoreMap.get(link.resultId) ?? 0) + link.points);
  }

  let maxScore = 0;
  for (const score of scoreMap.values()) {
    if (score > maxScore) maxScore = score;
  }

  const winnerIds = [...scoreMap.entries()]
    .filter(([, s]) => s === maxScore)
    .map(([id]) => id);

  // Tie-break: first result by order
  const winners = await prisma.result.findMany({
    where: { id: { in: winnerIds } },
    orderBy: { order: "asc" },
    take: 1,
  });

  return winners[0] ?? null;
}

// ---------------------------------------------------------------------------
// 6. evaluateCombinationLogic — Basic + Single chained
// ---------------------------------------------------------------------------

/**
 * Combination logic chains Basic path matching then Single product collection.
 *
 * Phase 1: Evaluate Basic logic to find the matched Result.
 * Phase 2: Collect linked product IDs via Single logic.
 *
 * Returns both the matched result and product list.
 *
 * Edge cases: no path match → result is null, products still collected.
 */
export async function evaluateCombinationLogic(
  prisma: PrismaClient,
  quizId: string,
  userAnswers: UserAnswer[],
): Promise<{ result: Result | null; productIds: string[] }> {
  const result = await evaluateBasicLogic(prisma, quizId, userAnswers);
  const { productIds } = await evaluateSingleLogic(prisma, quizId, userAnswers);
  return { result, productIds };
}

// ---------------------------------------------------------------------------
// 7. resolveNextQuestion — Logic jumps + sequential fallback
// ---------------------------------------------------------------------------

/**
 * Determines the next question after a selected answer.
 *
 * If the answer has `leadsToQuestionId`, follows that jump.
 * Otherwise returns the next question in `order` within the quiz.
 * Returns null when the quiz ends (no further questions).
 *
 * Edge cases: answer not found → falls through to order-based; no next
 * question → null.
 */
export async function resolveNextQuestion(
  prisma: PrismaClient,
  quizId: string,
  currentQuestionId: string,
  selectedAnswerId: string,
): Promise<Question | null> {
  const answer = await prisma.answer.findUnique({
    where: { id: selectedAnswerId },
    select: { leadsToQuestionId: true },
  });

  // Logic jump: follow explicit target (must belong to same quiz)
  if (answer?.leadsToQuestionId) {
    return prisma.question.findFirst({
      where: { id: answer.leadsToQuestionId, quizId },
    });
  }

  // Default: next question by order
  const current = await prisma.question.findUnique({
    where: { id: currentQuestionId },
    select: { order: true },
  });

  if (!current) return null;

  return prisma.question.findFirst({
    where: { quizId, order: { gt: current.order } },
    orderBy: { order: "asc" },
  });
}
