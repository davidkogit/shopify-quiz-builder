/**
 * Analytics Aggregate API
 *
 * GET /api/admin/analytics — Returns store-wide aggregate analytics metrics.
 *
 * Query params (optional):
 *   from? — Start of date range (ISO-8601)
 *   to?   — End of date range (ISO-8601)
 *
 * Every handler validates the Shopify session cookie and resolves the
 * corresponding Store record before any data operation.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { resolveStore } from "../../../../../lib/api-auth";

/**
 * Parse an optional date query parameter and return a Date object, or null
 * if the parameter is absent or invalid.
 */
function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Build a Prisma `createdAt` filter from optional `from`/`to` query params.
 * Returns `undefined` when neither param is provided (no date filtering).
 */
function buildDateFilter(
  from: string | null,
  to: string | null,
): { gte?: Date; lte?: Date } | undefined {
  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to);

  if (!fromDate && !toDate) return undefined;

  const filter: { gte?: Date; lte?: Date } = {};
  if (fromDate) filter.gte = fromDate;
  if (toDate) filter.lte = toDate;
  return filter;
}

// ---------------------------------------------------------------------------
// GET — Store-wide aggregate analytics
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const resolved = await resolveStore(req);
  if (resolved instanceof NextResponse) return resolved;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dateFilter = buildDateFilter(from, to);

  const storeFilter = { storeId: resolved.storeId };
  const eventWhere = { ...storeFilter, createdAt: dateFilter };
  const submissionWhere = { ...storeFilter, createdAt: dateFilter };
  const orderWhere = { ...storeFilter, createdAt: dateFilter };

  try {
    // Run all independent queries in parallel
    const [
      totalEngagements,
      totalCompletions,
      totalAddToCarts,
      totalSubmissions,
      orderAgg,
      quizzesCount,
    ] = await Promise.all([
      prisma.analyticsEvent.count({
        where: { ...eventWhere, event: "quiz_started" },
      }),
      prisma.analyticsEvent.count({
        where: { ...eventWhere, event: "quiz_completed" },
      }),
      prisma.analyticsEvent.count({
        where: { ...eventWhere, event: "add_to_cart" },
      }),
      prisma.submission.count({ where: submissionWhere }),
      prisma.orderAttribution.aggregate({
        where: orderWhere,
        _sum: { orderTotal: true },
        _count: true,
      }),
      prisma.quiz.count({ where: { storeId: resolved.storeId } }),
    ]);

    const attributedOrders = orderAgg._count;
    const totalRevenue = orderAgg._sum.orderTotal ?? 0;

    // Calculate derived metrics, guarding against division by zero
    const completionRate =
      totalEngagements > 0
        ? Math.round((totalCompletions / totalEngagements) * 100 * 100) / 100
        : 0;

    const averageOrderValue =
      attributedOrders > 0
        ? Math.round((totalRevenue / attributedOrders) * 100) / 100
        : 0;

    return NextResponse.json({
      analytics: {
        totalEngagements,
        totalCompletions,
        completionRate,
        totalSubmissions,
        totalAddToCarts,
        totalRevenue,
        averageOrderValue,
        attributedOrders,
        quizzesCount,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
