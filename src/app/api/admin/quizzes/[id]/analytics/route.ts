/**
 * Per-Quiz Analytics API
 *
 * GET /api/admin/quizzes/[id]/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns detailed analytics for a single quiz: summary metrics, top answers,
 * top products, per-question conversion funnel, and daily time-series.
 *
 * Validates session → store → quiz ownership before returning any data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "../../../../../../../lib/session";
import { getStore } from "../../../../../../../lib/store";
import { env } from "../../../../../../../lib/env";
import { prisma } from "../../../../../../../lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopAnswer {
  questionId: string;
  questionTitle: string;
  answerId: string;
  answerTitle: string;
  count: number;
}

interface TopProduct {
  productId: string;
  productTitle: string;
  count: number;
}

interface QuestionFunnelStep {
  questionTitle: string;
  viewCount: number;
  dropOffCount: number;
  dropOffRate: number;
}

interface TimeSeriesEntry {
  date: string;
  views: number;
  completions: number;
}

interface AnalyticsSummary {
  totalViews: number;
  totalCompletions: number;
  conversionRate: number;
  submissions: number;
  addToCarts: number;
  revenue: number;
  attributedOrders: number;
}

interface QuizAnalyticsResponse {
  quizId: string;
  quizName: string;
  summary: AnalyticsSummary;
  topAnswers: TopAnswer[];
  topProducts: TopProduct[];
  funnel: QuestionFunnelStep[];
  timeSeries: TimeSeriesEntry[];
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
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
  | { ok: true; storeId: string; quizId: string }
  | { ok: false; response: NextResponse }
> {
  const storeResult = await resolveStore(req);
  if (!storeResult.ok) return storeResult;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, storeId: true },
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

  return { ok: true, storeId: storeResult.storeId, quizId: quiz.id };
}

/**
 * Build an optional `createdAt` filtering clause from `from` / `to` query
 * parameters.  When `to` is a plain date (YYYY-MM-DD) it is treated as
 * inclusive by rounding to end-of-day.
 */
function buildDateFilter(
  fromStr: string | null,
  toStr: string | null,
): { createdAt?: { gte?: Date; lte?: Date } } {
  const createdAt: { gte?: Date; lte?: Date } = {};

  if (fromStr) createdAt.gte = new Date(fromStr);
  if (toStr) {
    const toDate = new Date(toStr);
    // If only date part supplied (10 chars), make it end-of-day inclusive
    if (toStr.length === 10) toDate.setHours(23, 59, 59, 999);
    createdAt.lte = toDate;
  }

  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

// ---------------------------------------------------------------------------
// GET — Per-quiz analytics
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const ownership = await resolveQuizOwnership(req, id);
  if (!ownership.ok) return ownership.response;

  try {
    const url = new URL(req.url);
    let fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");

    // Default to last 30 days when no date range is supplied, so the
    // time-series always shows a relevant window.
    if (!fromStr && !toStr) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromStr = thirtyDaysAgo.toISOString().slice(0, 10);
    }

    const dateFilter = buildDateFilter(fromStr, toStr);

    // Reusable event-level where clause for AnalyticsEvent queries
    const eventWhere: Record<string, unknown> = {
      quizId: ownership.quizId,
      ...dateFilter,
    };

    // ------------------------------------------------------------------
    // Phase 1 — Fetch all raw data in parallel
    // ------------------------------------------------------------------

    const [
      quiz,
      engagementCount,
      completionCount,
      submissionCount,
      addToCartCount,
      orderAgg,
      allSubmissions,
      allQuestions,
      timelineEvents,
      questionEventCounts,
    ] = await Promise.all([
      // Quiz metadata
      prisma.quiz.findUnique({
        where: { id: ownership.quizId },
        select: { id: true, name: true, status: true, logicType: true },
      }),

      // Engagements — quiz_started events
      prisma.analyticsEvent.count({
        where: { ...eventWhere, event: "quiz_started" },
      }),

      // Completions — quiz_completed events
      prisma.analyticsEvent.count({
        where: { ...eventWhere, event: "quiz_completed" },
      }),

      // Submissions
      prisma.submission.count({
        where: { quizId: ownership.quizId, ...dateFilter },
      }),

      // Add-to-cart events
      prisma.analyticsEvent.count({
        where: { ...eventWhere, event: "add_to_cart" },
      }),

      // Order attribution aggregate (revenue + count)
      prisma.orderAttribution.aggregate({
        where: { quizId: ownership.quizId, ...dateFilter },
        _sum: { orderTotal: true },
        _count: { id: true },
      }),

      // All submissions (for topAnswers from answers JSON + topProducts from recommendedProducts)
      prisma.submission.findMany({
        where: { quizId: ownership.quizId, ...dateFilter },
        select: { answers: true, recommendedProducts: true },
      }),

      // All questions (for per-question funnel)
      prisma.question.findMany({
        where: { quizId: ownership.quizId },
        select: { id: true, title: true, order: true },
        orderBy: { order: "asc" },
      }),

      // Timeline events (quiz_started + quiz_completed for time-series)
      prisma.analyticsEvent.findMany({
        where: {
          quizId: ownership.quizId,
          ...dateFilter,
          event: { in: ["quiz_started", "quiz_completed"] },
        },
        select: { event: true, createdAt: true },
      }),

      // Question-level view counts (for per-question funnel)
      prisma.analyticsEvent.groupBy({
        by: ["questionId"],
        where: {
          quizId: ownership.quizId,
          ...dateFilter,
          event: "question_answered",
          questionId: { not: null },
        },
        _count: { questionId: true },
      }),
    ]);

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // ------------------------------------------------------------------
    // Phase 2 — Compute derived metrics & breakdowns
    // ------------------------------------------------------------------

    // Completion rate (avoid division by zero)
    const conversionRate =
      engagementCount > 0
        ? Math.round((completionCount / engagementCount) * 10000) / 100
        : 0;

    // --- Top answers — from Submission.answers JSON ---
    // Each submission has answers: [{questionId, questionTitle, answerIds[], answerTitles[]}]
    // Count occurrences of each unique answerId across all submissions.
    const answerCountMap = new Map<string, number>();
    // Also track questionId and answerTitle per answerId for enrichment
    const answerMetaMap = new Map<
      string,
      { questionId: string; questionTitle: string; answerTitle: string }
    >();

    for (const sub of allSubmissions) {
      try {
        const parsed: {
          questionId?: string;
          questionTitle?: string;
          answerIds?: string[];
          answerTitles?: string[];
        }[] = JSON.parse(sub.answers);
        if (!Array.isArray(parsed)) continue;

        for (const entry of parsed) {
          const ids = entry.answerIds ?? [];
          const titles = entry.answerTitles ?? [];
          const qId = entry.questionId ?? "";
          const qTitle = entry.questionTitle ?? "Unknown";

          for (let i = 0; i < ids.length; i++) {
            const aId = ids[i];
            if (!aId) continue;
            answerCountMap.set(aId, (answerCountMap.get(aId) ?? 0) + 1);
            if (!answerMetaMap.has(aId)) {
              answerMetaMap.set(aId, {
                questionId: qId,
                questionTitle: qTitle,
                answerTitle: titles[i] ?? "Unknown",
              });
            }
          }
        }
      } catch {
        // Skip submissions with malformed answers JSON
      }
    }

    // Build topAnswers array (top 10)
    const topAnswers: TopAnswer[] = Array.from(answerCountMap.entries())
      .map(([answerId, count]) => {
        const meta = answerMetaMap.get(answerId);
        return {
          questionId: meta?.questionId ?? "",
          questionTitle: meta?.questionTitle ?? "Unknown",
          answerId,
          answerTitle: meta?.answerTitle ?? "Unknown",
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Top products — from Submission.recommendedProducts JSON ---
    const productCountMap = new Map<string, { title: string; count: number }>();
    for (const sub of allSubmissions) {
      try {
        const products: { shopifyProductId?: string; title?: string }[] =
          JSON.parse(sub.recommendedProducts);
        if (!Array.isArray(products)) continue;
        for (const p of products) {
          const pid = p.shopifyProductId;
          if (!pid) continue;
          const existing = productCountMap.get(pid);
          if (existing) {
            existing.count++;
          } else {
            productCountMap.set(pid, { title: p.title ?? pid, count: 1 });
          }
        }
      } catch {
        // Skip submissions with malformed JSON
      }
    }

    const topProducts: TopProduct[] = Array.from(productCountMap.entries())
      .map(([productId, { title, count }]) => ({
        productId,
        productTitle: title,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Per-question funnel ---
    // viewCount: how many times this question was answered
    // dropOffCount: difference between this question's viewCount and the next
    // dropOffRate: dropOffCount / viewCount * 100
    const questionViewMap = new Map<string, number>();
    for (const ec of questionEventCounts) {
      if (ec.questionId) {
        questionViewMap.set(ec.questionId, ec._count.questionId);
      }
    }

    const funnel: QuestionFunnelStep[] = [];
    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      const viewCount = questionViewMap.get(q.id) ?? 0;
      const nextQ = allQuestions[i + 1];
      const nextViewCount = nextQ
        ? (questionViewMap.get(nextQ.id) ?? 0)
        : completionCount;
      const dropOffCount = Math.max(0, viewCount - nextViewCount);
      const dropOffRate =
        viewCount > 0
          ? Math.round((dropOffCount / viewCount) * 10000) / 100
          : 0;

      funnel.push({
        questionTitle: q.title,
        viewCount,
        dropOffCount,
        dropOffRate,
      });
    }

    // --- Time-series — group events by date ---
    const dateMap = new Map<string, { views: number; completions: number }>();
    for (const ev of timelineEvents) {
      const date = ev.createdAt.toISOString().slice(0, 10);
      const entry = dateMap.get(date) ?? { views: 0, completions: 0 };
      if (ev.event === "quiz_started") entry.views++;
      if (ev.event === "quiz_completed") entry.completions++;
      dateMap.set(date, entry);
    }

    const timeSeries: TimeSeriesEntry[] = Array.from(dateMap.entries())
      .map(([date, counts]) => ({
        date,
        views: counts.views,
        completions: counts.completions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ------------------------------------------------------------------
    // Phase 3 — Assemble response
    // ------------------------------------------------------------------

    const analytics: QuizAnalyticsResponse = {
      quizId: quiz.id,
      quizName: quiz.name,
      summary: {
        totalViews: engagementCount,
        totalCompletions: completionCount,
        conversionRate,
        submissions: submissionCount,
        addToCarts: addToCartCount,
        revenue: orderAgg._sum.orderTotal ?? 0,
        attributedOrders: orderAgg._count.id,
      },
      topAnswers,
      topProducts,
      funnel,
      timeSeries,
      computedAt: new Date().toISOString(),
    };

    return NextResponse.json({ analytics });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
