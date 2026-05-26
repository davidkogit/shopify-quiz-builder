/**
 * Submissions List Page
 *
 * Server component that resolves the Shopify session, queries submissions
 * with filtering and pagination, and renders the admin submissions UI.
 * Filter controls update URL search params for shareable/bookmarkable URLs.
 *
 * Architecture:
 *   - Server: fetch submissions + quiz list via Prisma
 *   - Client islands: SubmissionsFilters (URL-synced inputs),
 *     SubmissionsTable (presentational table + mobile cards)
 */

import { Suspense } from "react";
import { cookies } from "next/headers";
import { getSessionFromCookie } from "../../../../lib/session";
import { getStore } from "../../../../lib/store";
import { env } from "../../../../lib/env";
import { prisma } from "../../../../lib/prisma";
import { SubmissionsTable } from "@/components/admin/submissions/submissions-table";
import { SubmissionsFilters } from "@/components/admin/submissions/submissions-filters";
import type { SubmissionRow } from "@/components/admin/submissions/submissions-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{
    quizId?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseIntParam(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function countProducts(raw: string): number {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Data fetching (server-side)
// ---------------------------------------------------------------------------

interface FetchResult {
  submissions: SubmissionRow[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  quizzes: { id: string; name: string }[];
}

async function fetchData(
  storeId: string,
  searchParams: Awaited<PageProps["searchParams"]>,
): Promise<FetchResult> {
  const { quizId, search, from, to, page: pageStr, limit: limitStr } = searchParams;

  const page = parseIntParam(pageStr, 1);
  const limit = Math.min(parseIntParam(limitStr, 25), 100);

  // Build Prisma where clause
  const where: Record<string, unknown> = { storeId };

  if (quizId) where.quizId = quizId;

  if (search) {
    // SQLite LIKE is case-insensitive for ASCII, so no explicit mode needed.
    const sf = { contains: search };
    where.OR = [{ email: sf }, { name: sf }, { sessionId: sf }];
  }

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (fromDate || toDate) {
    const createdAtFilter: Record<string, Date> = {};
    if (fromDate) createdAtFilter.gte = fromDate;
    if (toDate) createdAtFilter.lte = toDate;
    where.createdAt = createdAtFilter;
  }

  const [submissions, total, quizzes] = await Promise.all([
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
    prisma.quiz.findMany({
      where: { storeId },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const rows: SubmissionRow[] = submissions.map((s) => ({
    id: s.id,
    quizId: s.quizId,
    quizName: s.quiz.name,
    email: s.email,
    name: s.name,
    sessionId: s.sessionId,
    createdAt: s.createdAt.toISOString(),
    resultTitle: null,
    productCount: countProducts(s.recommendedProducts),
    status: (s.resultId ? "completed" : "abandoned") as SubmissionRow["status"],
  }));

  return { submissions: rows, total, page, totalPages, limit, quizzes };
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

export default async function SubmissionsPage(props: PageProps) {
  const searchParams = await props.searchParams;

  // Resolve session & store
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore, env.SESSION_SECRET);

  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-6">Submissions</h1>
        <p className="text-sm text-muted-foreground">
          Please log in to view submissions.
        </p>
      </div>
    );
  }

  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-6">Submissions</h1>
        <p className="text-sm text-muted-foreground">Store not found.</p>
      </div>
    );
  }

  const data = await fetchData(store.id, searchParams);

  // Build search-params record for pagination link preservation
  const paginationParams: Record<string, string | undefined> = {};
  if (searchParams.quizId) paginationParams.quizId = searchParams.quizId;
  if (searchParams.search) paginationParams.search = searchParams.search;
  if (searchParams.from) paginationParams.from = searchParams.from;
  if (searchParams.to) paginationParams.to = searchParams.to;
  if (searchParams.limit) paginationParams.limit = searchParams.limit;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Submissions</h1>
      </div>

      {/* Filters (client island with URL sync) */}
      <Suspense fallback={null}>
        <SubmissionsFilters quizzes={data.quizzes} />
      </Suspense>

      {/* Table / results */}
      <div className="mt-6">
        <SubmissionsTable
          submissions={data.submissions}
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          searchParams={paginationParams}
        />
      </div>
    </div>
  );
}
