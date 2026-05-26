/**
 * Submissions API — List submissions for the authenticated store.
 *
 * GET /api/admin/submissions
 *   Query params: quizId?, search?, from?, to?, page?, limit?
 *   Returns: { submissions[], total, page, totalPages }
 *
 * Every handler validates the Shopify session cookie and resolves the
 * corresponding Store record before any data operation.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { resolveStore } from "../../../../../lib/api-auth";

/**
 * Parse a date-string query param into a Date or undefined.
 */
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Parse a positive-int query param with a default fallback.
 */
function parseIntParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Count the number of recommended products from a JSON string.
 * Handles both JSON-array and already-parsed-array values.
 */
function countProducts(raw: string): number {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmissionRow {
  id: string;
  quizId: string;
  quizName: string;
  email: string | null;
  name: string | null;
  sessionId: string;
  createdAt: Date;
  resultTitle: string | null;
  productCount: number;
  status: "completed" | "abandoned";
}

// ---------------------------------------------------------------------------
// GET — List submissions with filtering & pagination
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const resolved = await resolveStore(req);
  if (resolved instanceof NextResponse) return resolved;

  const { searchParams } = req.nextUrl;

  const quizId = searchParams.get("quizId") || undefined;
  const search = searchParams.get("search") || undefined;
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const page = parseIntParam(searchParams.get("page"), 1);
  const limit = Math.min(parseIntParam(searchParams.get("limit"), 25), 100);

  try {
    // Build the Prisma where clause
    const where: Record<string, unknown> = {
      storeId: resolved.storeId,
    };

    if (quizId) {
      where.quizId = quizId;
    }

    // Build search OR across email, name, sessionId.
    // SQLite LIKE is case-insensitive for ASCII, so no mode needed.
    if (search) {
      const searchFilter = { contains: search };
      where.OR = [
        { email: searchFilter },
        { name: searchFilter },
        { sessionId: searchFilter },
      ];
    }

    // Date range filter
    if (from || to) {
      const createdAtFilter: Record<string, Date> = {};
      if (from) createdAtFilter.gte = from;
      if (to) createdAtFilter.lte = to;
      where.createdAt = createdAtFilter;
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          quiz: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.submission.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const rows: SubmissionRow[] = submissions.map((s) => ({
      id: s.id,
      quizId: s.quizId,
      quizName: s.quiz.name,
      email: s.email,
      name: s.name,
      sessionId: s.sessionId,
      createdAt: s.createdAt,
      resultTitle: null,
      productCount: countProducts(s.recommendedProducts),
      status: s.resultId ? "completed" : "abandoned",
    }));

    return NextResponse.json({ submissions: rows, total, page, totalPages });
  } catch {
    return NextResponse.json(
      { error: "Failed to list submissions" },
      { status: 500 },
    );
  }
}
