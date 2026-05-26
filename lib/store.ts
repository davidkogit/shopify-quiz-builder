/**
 * Store CRUD Module
 *
 * Provides pure, explicit-dependency functions for managing Store records
 * in the database. Every function accepts a PrismaClient instance as its
 * first parameter so callers control the lifecycle and transaction scope.
 *
 * Functions:
 * - upsertStore — create or update a store on OAuth install / re-install.
 * - getStore    — look up a store by its `.myshopify.com` domain.
 * - deleteStore — cascade-delete a store and all its related data on uninstall.
 */

import type { PrismaClient, Store } from "@prisma/client";

// ---------------------------------------------------------------------------
// upsertStore
// ---------------------------------------------------------------------------

/**
 * Insert or update a Store record.
 *
 * On first install the store is created; on re-install the access token and
 * scopes are refreshed in place.  The `shopifyDomain` serves as the unique
 * natural key.
 *
 * @returns The persisted Store record.
 */
export async function upsertStore(
  prisma: PrismaClient,
  shopDomain: string,
  accessToken: string,
  scopes: string,
): Promise<Store> {
  return prisma.store.upsert({
    where: { shopifyDomain: shopDomain },
    update: { accessToken, scopes },
    create: { shopifyDomain: shopDomain, accessToken, scopes },
  });
}

// ---------------------------------------------------------------------------
// getStore
// ---------------------------------------------------------------------------

/**
 * Fetch a Store by its Shopify domain.
 *
 * @returns The Store record, or `null` if no store exists for the domain.
 */
export async function getStore(
  prisma: PrismaClient,
  shopDomain: string,
): Promise<Store | null> {
  return prisma.store.findUnique({
    where: { shopifyDomain: shopDomain },
  });
}

// ---------------------------------------------------------------------------
// deleteStore
// ---------------------------------------------------------------------------

/**
 * Cascade-delete a store and every related record inside a transaction.
 * SQLite lacks FK enforcement so the cascade is manual (bottom-up).
 */
export async function deleteStore(
  prisma: PrismaClient,
  shopDomain: string,
): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain }, select: { id: true },
  });
  if (!store) return;

  await prisma.$transaction(async (tx) => {
    const storeId = store.id;
    const quizIds = (await tx.quiz.findMany({
      where: { storeId }, select: { id: true },
    })).map((q) => q.id);

    const questionIds = quizIds.length > 0 ? (await tx.question.findMany({
      where: { quizId: { in: quizIds } }, select: { id: true },
    })).map((q) => q.id) : [];
    const answerIds = questionIds.length > 0 ? (await tx.answer.findMany({
      where: { questionId: { in: questionIds } }, select: { id: true },
    })).map((a) => a.id) : [];
    const resultIds = quizIds.length > 0 ? (await tx.result.findMany({
      where: { quizId: { in: quizIds } }, select: { id: true },
    })).map((r) => r.id) : [];

    if (answerIds.length > 0) {
      await tx.answerProduct.deleteMany({ where: { answerId: { in: answerIds } } });
      await tx.answerProductWeight.deleteMany({ where: { answerId: { in: answerIds } } });
      await tx.answerResultLink.deleteMany({ where: { answerId: { in: answerIds } } });
      await tx.resultPathAnswer.deleteMany({ where: { answerId: { in: answerIds } } });
      await tx.answer.deleteMany({ where: { id: { in: answerIds } } });
    }
    if (resultIds.length > 0) {
      await tx.answerResultLink.deleteMany({ where: { resultId: { in: resultIds } } });
      await tx.result.deleteMany({ where: { id: { in: resultIds } } });
    }
    await tx.resultPath.deleteMany({ where: { quizId: { in: quizIds } } });
    if (questionIds.length > 0) {
      await tx.question.deleteMany({ where: { id: { in: questionIds } } });
    }
    await tx.analyticsEvent.deleteMany({ where: { storeId } });
    await tx.submission.deleteMany({ where: { storeId } });
    await tx.quiz.deleteMany({ where: { storeId } });
    await tx.store.delete({ where: { id: storeId } });
  });
}
