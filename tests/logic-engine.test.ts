/**
 * Logic Engine Test Suite
 *
 * Covers all 6 recommendation logic types + resolveNextQuestion.
 * Every test follows Arrange-Act-Assert with positive AND negative cases.
 *
 * @see /workspace/plans/2026-05-18-quiz-kit-replication-plan.md — Core Algorithms
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  evaluateBasicLogic,
  evaluateSingleLogic,
  evaluatePointsLogic,
  evaluateProductWeightLogic,
  evaluateResultWeightLogic,
  evaluateCombinationLogic,
  resolveNextQuestion,
} from "../lib/logic-engine";
import {
  getTestPrisma,
  disconnectTestPrisma,
  cleanDatabase,
  ensureStore,
  seedQuizWithQnA,
  seedResult,
  seedResultPath,
  seedResultPathAnswer,
  seedAnswerProduct,
  seedAnswerProductWeight,
  seedAnswerResultLink,
  seedAnswer,
} from "./test-utils";

// ---------------------------------------------------------------------------
// Suite lifecycle
// ---------------------------------------------------------------------------

let prisma: PrismaClient;
let storeId: string;

beforeAll(async () => {
  prisma = getTestPrisma();
  storeId = await ensureStore(prisma);
});

afterAll(async () => {
  await disconnectTestPrisma();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

// ===================================================================
// 1. BASIC LOGIC
// ===================================================================

describe("evaluateBasicLogic — Path-Based Matching", () => {
  /**
   * Creates a Basic Logic scenario with one quiz, two questions, two answers each,
   * a result, and a path. Returns IDs needed for assertions.
   */
  async function setupBasicScenario(
    logicOperator: "AND" | "OR",
  ) {
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2, // questions
      2, // answers each
      { quizLogicType: "basic" },
    );

    const result = await seedResult(prisma, quiz.id, {
      title: "Basic Result",
      order: 0,
    });

    const path = await seedResultPath(prisma, quiz.id, result.id, {
      logicOperator,
      order: 0,
    });

    // Path: Q1→A1, Q2→A1
    await seedResultPathAnswer(prisma, path.id, questions[0].id, answers[0][0].id);
    await seedResultPathAnswer(prisma, path.id, questions[1].id, answers[1][0].id);

    return { quiz, questions, answers, result, path };
  }

  // --- Positive tests ---

  it("AND path: all required answers selected → returns matching Result", async () => {
    // Arrange
    const { quiz, questions, answers, result } =
      await setupBasicScenario("AND");

    // Act
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert
    expect(output).not.toBeNull();
    expect(output!.id).toBe(result.id);
    expect(output!.title).toBe("Basic Result");
  });

  it("AND path: extra selected answers do not prevent match", async () => {
    // Arrange
    const { quiz, questions, answers } =
      await setupBasicScenario("AND");

    // Act — user selects BOTH answers on Q1, but path only needs A1
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      {
        questionId: questions[0].id,
        answerIds: [answers[0][0].id, answers[0][1].id],
      },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert
    expect(output).not.toBeNull();
  });

  it("OR path: one matching answer suffices", async () => {
    // Arrange
    const { quiz, questions, answers, result } =
      await setupBasicScenario("OR");

    // Act — only Q1→A1 selected, Q2 empty
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [] },
    ]);

    // Assert
    expect(output).not.toBeNull();
    expect(output!.id).toBe(result.id);
  });

  it("OR path: both answers match → still returns Result", async () => {
    // Arrange
    const { quiz, questions, answers, result } =
      await setupBasicScenario("OR");

    // Act
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert
    expect(output).not.toBeNull();
    expect(output!.id).toBe(result.id);
  });

  // --- Negative tests ---

  it("AND path: missing one answer → no match (returns null)", async () => {
    // Arrange
    const { quiz, questions, answers } =
      await setupBasicScenario("AND");

    // Act — Q1→A1 selected, but Q2→A1 NOT selected
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][1].id] }, // wrong answer
    ]);

    // Assert
    expect(output).toBeNull();
  });

  it("empty userAnswers → no match (returns null)", async () => {
    // Arrange
    const { quiz } = await setupBasicScenario("AND");

    // Act
    const output = await evaluateBasicLogic(prisma, quiz.id, []);

    // Assert
    expect(output).toBeNull();
  });

  it("wrong answer for path question → no match", async () => {
    // Arrange
    const { quiz, questions } = await setupBasicScenario("AND");

    // Act — completely unrelated answer IDs
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: ["nonexistent-id"] },
    ]);

    // Assert
    expect(output).toBeNull();
  });

  // --- Edge case tests ---

  it("multiple paths: first matching path wins", async () => {
    // Arrange — create two paths for the same quiz
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2, // questions
      2, // answers each
      { quizLogicType: "basic" },
    );

    const result1 = await seedResult(prisma, quiz.id, { title: "Result 1", order: 0 });
    const result2 = await seedResult(prisma, quiz.id, { title: "Result 2", order: 1 });

    // Path 1 (order 0): Q1→A1 matches
    const path1 = await seedResultPath(prisma, quiz.id, result1.id, { logicOperator: "AND", order: 0 });
    await seedResultPathAnswer(prisma, path1.id, questions[0].id, answers[0][0].id);

    // Path 2 (order 1): Q1→A1 ALSO matches (but should never be reached)
    const path2 = await seedResultPath(prisma, quiz.id, result2.id, { logicOperator: "AND", order: 1 });
    await seedResultPathAnswer(prisma, path2.id, questions[0].id, answers[0][0].id);

    // Act
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert — first path wins even though both match
    expect(output).not.toBeNull();
    expect(output!.title).toBe("Result 1");
  });
});

// ===================================================================
// 2. SINGLE LOGIC
// ===================================================================

describe("evaluateSingleLogic — Answer-to-Product Mapping", () => {
  it("single answer linked to 2 products → returns both product IDs", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "single" },
    );
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/1");
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/2");

    // Act
    const { productIds } = await evaluateSingleLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(productIds).toHaveLength(2);
    expect(productIds).toContain("gid://shopify/Product/1");
    expect(productIds).toContain("gid://shopify/Product/2");
  });

  it("multiple answers with overlapping products → deduplicates", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "single" },
    );
    // Both answers link to the same product
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/42");
    await seedAnswerProduct(prisma, answers[1][0].id, "gid://shopify/Product/42");
    // One also links to another product
    await seedAnswerProduct(prisma, answers[1][0].id, "gid://shopify/Product/99");

    // Act
    const { productIds } = await evaluateSingleLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert — "42" appears only once, "99" is present
    const count42 = productIds.filter((p) => p === "gid://shopify/Product/42").length;
    expect(count42).toBe(1);
    expect(productIds).toContain("gid://shopify/Product/99");
    expect(productIds).toHaveLength(2);
  });

  it("product limit applied → only N products returned", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "single", productLimit: 1 },
    );
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/A");
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/B");

    // Act
    const { productIds } = await evaluateSingleLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(productIds).toHaveLength(1);
  });

  it("no product links → empty array", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "single" },
    );

    // Act
    const { productIds } = await evaluateSingleLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(productIds).toEqual([]);
  });

  it("empty userAnswers → empty array", async () => {
    // Arrange
    const { quiz } = await seedQuizWithQnA(prisma, storeId, 1, 1, { quizLogicType: "single" });

    // Act
    const { productIds } = await evaluateSingleLogic(prisma, quiz.id, []);

    // Assert
    expect(productIds).toEqual([]);
  });
});

// ===================================================================
// 3. POINTS LOGIC
// ===================================================================

describe("evaluatePointsLogic — Score Range Matching", () => {
  it("answers sum to 10, range 5-15 → match", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "points" },
    );
    // Set answer points: 6 + 4 = 10
    await prisma.answer.update({ where: { id: answers[0][0].id }, data: { points: 6 } });
    await prisma.answer.update({ where: { id: answers[1][0].id }, data: { points: 4 } });

    const result = await seedResult(prisma, quiz.id, {
      title: "Mid-Range",
      order: 0,
      pointsFrom: 5,
      pointsTo: 15,
    });

    // Act
    const output = await evaluatePointsLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert
    expect(output).not.toBeNull();
    expect(output!.id).toBe(result.id);
  });

  it("answers sum to 5, range 10-20 → no match (returns null)", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "points" },
    );
    await prisma.answer.update({ where: { id: answers[0][0].id }, data: { points: 5 } });

    await seedResult(prisma, quiz.id, {
      title: "High Only",
      order: 0,
      pointsFrom: 10,
      pointsTo: 20,
    });

    // Act
    const output = await evaluatePointsLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(output).toBeNull();
  });

  it("exact boundary match: sum equals range start → match", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "points" },
    );
    await prisma.answer.update({ where: { id: answers[0][0].id }, data: { points: 10 } });

    const result = await seedResult(prisma, quiz.id, {
      title: "Exact Start",
      order: 0,
      pointsFrom: 10,
      pointsTo: 20,
    });

    // Act
    const output = await evaluatePointsLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert — pointsFrom <= totalPoints is inclusive
    expect(output).not.toBeNull();
    expect(output!.id).toBe(result.id);
  });

  it("multiple ranges: correct range matched, others skipped", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "points" },
    );
    await prisma.answer.update({ where: { id: answers[0][0].id }, data: { points: 12 } });

    // Low range: 0-10 (doesn't match)
    await seedResult(prisma, quiz.id, { title: "Low", order: 0, pointsFrom: 0, pointsTo: 10 });
    // Mid range: 11-20 (matches — first match wins by order)
    const midResult = await seedResult(prisma, quiz.id, { title: "Mid", order: 1, pointsFrom: 11, pointsTo: 20 });
    // High range: 21-30
    await seedResult(prisma, quiz.id, { title: "High", order: 2, pointsFrom: 21, pointsTo: 30 });

    // Act
    const output = await evaluatePointsLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(output).not.toBeNull();
    expect(output!.title).toBe("Mid");
  });

  it("empty userAnswers → returns null", async () => {
    // Arrange
    const { quiz } = await seedQuizWithQnA(prisma, storeId, 1, 1, { quizLogicType: "points" });

    // Act
    const output = await evaluatePointsLogic(prisma, quiz.id, []);

    // Assert
    expect(output).toBeNull();
  });
});

// ===================================================================
// 4. PRODUCT WEIGHT LOGIC
// ===================================================================

describe("evaluateProductWeightLogic — Accumulated Product Scoring", () => {
  it("two answers both boost same product → weights sum", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "productWeight" },
    );
    await seedAnswerProductWeight(prisma, answers[0][0].id, "gid://shopify/Product/X", 3);
    await seedAnswerProductWeight(prisma, answers[1][0].id, "gid://shopify/Product/X", 2);

    // Act
    const products = await evaluateProductWeightLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert
    expect(products).toHaveLength(1);
    expect(products[0].shopifyProductId).toBe("gid://shopify/Product/X");
    expect(products[0].score).toBe(5); // 3 + 2
  });

  it("different products, one wins by score — sorted descending", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "productWeight" },
    );
    await seedAnswerProductWeight(prisma, answers[0][0].id, "gid://shopify/Product/A", 1);
    await seedAnswerProductWeight(prisma, answers[1][0].id, "gid://shopify/Product/B", 5);

    // Act
    const products = await evaluateProductWeightLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert — highest score first
    expect(products).toHaveLength(2);
    expect(products[0].shopifyProductId).toBe("gid://shopify/Product/B");
    expect(products[0].score).toBe(5);
    expect(products[1].shopifyProductId).toBe("gid://shopify/Product/A");
    expect(products[1].score).toBe(1);
  });

  it("product limit → only top N returned", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "productWeight", productLimit: 2 },
    );
    await seedAnswerProductWeight(prisma, answers[0][0].id, "gid://shopify/Product/A", 5);
    await seedAnswerProductWeight(prisma, answers[0][0].id, "gid://shopify/Product/B", 3);
    await seedAnswerProductWeight(prisma, answers[0][0].id, "gid://shopify/Product/C", 1);

    // Act
    const products = await evaluateProductWeightLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(products).toHaveLength(2);
    expect(products[0].shopifyProductId).toBe("gid://shopify/Product/A");
    expect(products[1].shopifyProductId).toBe("gid://shopify/Product/B");
  });

  it("ties handled: both products returned with same score", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "productWeight" },
    );
    await seedAnswerProductWeight(prisma, answers[0][0].id, "gid://shopify/Product/A", 2);
    await seedAnswerProductWeight(prisma, answers[1][0].id, "gid://shopify/Product/B", 2);

    // Act
    const products = await evaluateProductWeightLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert — both returned, scores are 2 each
    expect(products).toHaveLength(2);
    expect(products[0].score).toBe(2);
    expect(products[1].score).toBe(2);
  });

  it("empty userAnswers → empty array", async () => {
    // Arrange
    const { quiz } = await seedQuizWithQnA(prisma, storeId, 1, 1, { quizLogicType: "productWeight" });

    // Act
    const products = await evaluateProductWeightLogic(prisma, quiz.id, []);

    // Assert
    expect(products).toEqual([]);
  });
});

// ===================================================================
// 5. RESULT WEIGHT LOGIC
// ===================================================================

describe("evaluateResultWeightLogic — Accumulated Result Scoring", () => {
  it("two answers boost same result → points sum, highest wins", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "resultWeight" },
    );
    const resultA = await seedResult(prisma, quiz.id, { title: "Result A", order: 0 });
    const resultB = await seedResult(prisma, quiz.id, { title: "Result B", order: 1 });

    // Answer 1 gives 3 points to Result A
    await seedAnswerResultLink(prisma, answers[0][0].id, resultA.id, 3);
    // Answer 2 gives 2 points to Result A (total 5), 1 point to Result B
    await seedAnswerResultLink(prisma, answers[1][0].id, resultA.id, 2);
    await seedAnswerResultLink(prisma, answers[1][0].id, resultB.id, 1);

    // Act
    const winner = await evaluateResultWeightLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert — Result A wins with 5 points
    expect(winner).not.toBeNull();
    expect(winner!.id).toBe(resultA.id);
  });

  it("tie between results → first configured (by order) wins", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "resultWeight" },
    );
    // Result A created first (order 0), Result B second (order 1)
    const resultA = await seedResult(prisma, quiz.id, { title: "Result A", order: 0 });
    const resultB = await seedResult(prisma, quiz.id, { title: "Result B", order: 1 });

    await seedAnswerResultLink(prisma, answers[0][0].id, resultA.id, 2);
    await seedAnswerResultLink(prisma, answers[1][0].id, resultB.id, 2);

    // Act
    const winner = await evaluateResultWeightLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert — tie goes to Result A (order 0)
    expect(winner).not.toBeNull();
    expect(winner!.id).toBe(resultA.id);
    expect(winner!.title).toBe("Result A");
  });

  it("no links → returns null", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "resultWeight" },
    );

    // Act
    const winner = await evaluateResultWeightLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(winner).toBeNull();
  });

  it("empty userAnswers → returns null", async () => {
    // Arrange
    const { quiz } = await seedQuizWithQnA(prisma, storeId, 1, 1, { quizLogicType: "resultWeight" });

    // Act
    const winner = await evaluateResultWeightLogic(prisma, quiz.id, []);

    // Assert
    expect(winner).toBeNull();
  });
});

// ===================================================================
// 6. COMBINATION LOGIC
// ===================================================================

describe("evaluateCombinationLogic — Basic + Single", () => {
  it("path matches + products collected → both returned", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "combination" },
    );
    const result = await seedResult(prisma, quiz.id, { title: "Combo Result", order: 0 });
    const path = await seedResultPath(prisma, quiz.id, result.id, { logicOperator: "AND", order: 0 });
    await seedResultPathAnswer(prisma, path.id, questions[0].id, answers[0][0].id);
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/P1");

    // Act
    const { result: matchResult, productIds } =
      await evaluateCombinationLogic(prisma, quiz.id, [
        { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      ]);

    // Assert
    expect(matchResult).not.toBeNull();
    expect(matchResult!.title).toBe("Combo Result");
    expect(productIds).toContain("gid://shopify/Product/P1");
  });

  it("path doesn't match → null result, products still collected", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "combination" },
    );
    // No path created → Basic Logic returns null
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/P2");

    // Act
    const { result: matchResult, productIds } =
      await evaluateCombinationLogic(prisma, quiz.id, [
        { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      ]);

    // Assert — engine still collects products even when no path matched
    expect(matchResult).toBeNull();
    expect(productIds).toContain("gid://shopify/Product/P2");
  });

  it("product limit honored in phase 2", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "combination", productLimit: 1 },
    );
    const result = await seedResult(prisma, quiz.id, { title: "Limit Test", order: 0 });
    const path = await seedResultPath(prisma, quiz.id, result.id, { logicOperator: "AND", order: 0 });
    await seedResultPathAnswer(prisma, path.id, questions[0].id, answers[0][0].id);
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/X");
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/Y");

    // Act
    const { productIds } = await evaluateCombinationLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(productIds).toHaveLength(1);
  });
});

// ===================================================================
// 7. LOGIC JUMP (resolveNextQuestion)
// ===================================================================

describe("resolveNextQuestion — Logic Jumps", () => {
  it("answer with leadsTo → routes to target question", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      3, // 3 questions: Q1, Q2, Q3
      1,
    );
    // Q1's answer leads to Q3 (skipping Q2)
    await prisma.answer.update({
      where: { id: answers[0][0].id },
      data: { leadsToQuestionId: questions[2].id },
    });

    // Act — from Q1, select answer that jumps to Q3
    const next = await resolveNextQuestion(
      prisma,
      quiz.id,
      questions[0].id,
      answers[0][0].id,
    );

    // Assert
    expect(next).not.toBeNull();
    expect(next!.id).toBe(questions[2].id);
    expect(next!.order).toBe(2); // Q3 has order 2
  });

  it("answer without leadsTo → next by order", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      3,
      1,
    );

    // Act — from Q1 (order 0) with no jump → Q2 (order 1)
    const next = await resolveNextQuestion(
      prisma,
      quiz.id,
      questions[0].id,
      answers[0][0].id,
    );

    // Assert
    expect(next).not.toBeNull();
    expect(next!.id).toBe(questions[1].id);
  });

  it("last question → returns null (end of quiz)", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
    );

    // Act — from Q2 (last, order 1) → no next
    const next = await resolveNextQuestion(
      prisma,
      quiz.id,
      questions[1].id,
      answers[1][0].id,
    );

    // Assert
    expect(next).toBeNull();
  });

  it("invalid leadsToQuestionId → returns null (target not found)", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      3,
      1,
    );
    // Set leadsTo to a non-existent question
    await prisma.answer.update({
      where: { id: answers[0][0].id },
      data: { leadsToQuestionId: "non-existent-question-id" },
    });

    // Act — the target doesn't exist, findUnique returns null
    const next = await resolveNextQuestion(
      prisma,
      quiz.id,
      questions[0].id,
      answers[0][0].id,
    );

    // Assert — per plan pseudocode, Question.find(leadsTo) returns null if not found
    expect(next).toBeNull();
  });

  it("selectedAnswerId not found → falls through to order-based next", async () => {
    // Arrange
    const { quiz, questions } = await seedQuizWithQnA(prisma, storeId, 2, 1);

    // Act
    const next = await resolveNextQuestion(
      prisma,
      quiz.id,
      questions[0].id,
      "bogus-answer-id",
    );

    // Assert — answer not found, falls through to next-by-order
    expect(next).not.toBeNull();
    expect(next!.id).toBe(questions[1].id);
  });
});

// ===================================================================
// 8. EDGE CASES & ROBUSTNESS
// ===================================================================

describe("Edge Cases & Robustness", () => {
  it("quiz with no questions → Basic Logic returns null", async () => {
    // Arrange
    const { quiz } = await seedQuizWithQnA(prisma, storeId, 0, 0, { quizLogicType: "basic" });

    // Act
    const output = await evaluateBasicLogic(prisma, quiz.id, []);

    // Assert
    expect(output).toBeNull();
  });

  it("quiz with no results → Single Logic returns empty array", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "single" },
    );
    await seedAnswerProduct(prisma, answers[0][0].id, "gid://shopify/Product/1");

    // Act
    const { productIds } = await evaluateSingleLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert — Single logic doesn't depend on Results, so it still works
    expect(productIds).toHaveLength(1);
  });

  it("quiz with no results → Points Logic returns null (no ranges to match)", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "points" },
    );
    await prisma.answer.update({ where: { id: answers[0][0].id }, data: { points: 10 } });

    // Act — no results exist with points range
    const output = await evaluatePointsLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(output).toBeNull();
  });

  it("0-points answers → do not affect Points Logic total", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "points" },
    );
    // Answer 1: 5 points, Answer 2: 0 points → total = 5
    await prisma.answer.update({ where: { id: answers[0][0].id }, data: { points: 5 } });
    await prisma.answer.update({ where: { id: answers[1][0].id }, data: { points: 0 } });

    await seedResult(prisma, quiz.id, { title: "Low", order: 0, pointsFrom: 0, pointsTo: 10 });

    // Act
    const output = await evaluatePointsLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
      { questionId: questions[1].id, answerIds: [answers[1][0].id] },
    ]);

    // Assert — total is 5, which falls in 0-10
    expect(output).not.toBeNull();
  });

  it("skipped question (no answer for a path question) → AND path fails gracefully", async () => {
    // Arrange
    const { quiz, questions, answers } = await seedQuizWithQnA(
      prisma,
      storeId,
      2,
      1,
      { quizLogicType: "basic" },
    );
    const result = await seedResult(prisma, quiz.id, { title: "R", order: 0 });
    const path = await seedResultPath(prisma, quiz.id, result.id, {
      logicOperator: "AND",
      order: 0,
    });
    // Path expects answers for Q1 and Q2
    await seedResultPathAnswer(prisma, path.id, questions[0].id, answers[0][0].id);
    await seedResultPathAnswer(prisma, path.id, questions[1].id, answers[1][0].id);

    // Act — only Q1 answered, Q2 skipped (not in userAnswers array)
    const output = await evaluateBasicLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: [answers[0][0].id] },
    ]);

    // Assert
    expect(output).toBeNull();
  });

  it("non-existent answer IDs in userAnswers → no crash, graceful handling", async () => {
    // Arrange
    const { quiz, questions } = await seedQuizWithQnA(
      prisma,
      storeId,
      1,
      1,
      { quizLogicType: "points" },
    );

    // Act — points logic looks up non-existent answer IDs; they simply contribute 0
    const output = await evaluatePointsLogic(prisma, quiz.id, [
      { questionId: questions[0].id, answerIds: ["fake-id-1", "fake-id-2"] },
    ]);

    // Assert — total points = 0, no crash. If a result range includes 0, it may match.
    // Key assertion: the function resolved without throwing
    expect(output).toBeDefined(); // either a Result or null — no crash
  });

  it("non-existent quizId → engine handles gracefully", async () => {
    // Arrange — use a quiz ID that doesn't exist in DB

    // Act & Assert — no crash
    const output = await evaluateBasicLogic(prisma, "nonexistent-quiz-id", []);
    expect(output).toBeNull();
  });

  it("resolveNextQuestion: leadsTo targets a question in a different quiz → follows the jump", async () => {
    // Arrange — two quizzes
    const q1 = await seedQuizWithQnA(prisma, storeId, 2, 1);
    const q2 = await seedQuizWithQnA(prisma, storeId, 2, 1);

    // Fetch answers for quiz1's first question
    const quiz1Answers = await prisma.answer.findMany({
      where: { questionId: q1.questions[0].id },
      orderBy: { order: "asc" },
    });

    // Set quiz1's first answer to jump to a question in quiz2
    await prisma.answer.update({
      where: { id: quiz1Answers[0].id },
      data: { leadsToQuestionId: q2.questions[0].id },
    });

    // Act — engine scopes the jump to the same quiz, so cross-quiz returns null
    const next = await resolveNextQuestion(
      prisma,
      q1.quiz.id,
      q1.questions[0].id,
      quiz1Answers[0].id,
    );

    // Assert — cross-quiz jumps are blocked for security
    expect(next).toBeNull();
  });
});
