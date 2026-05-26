/**
 * Analytics Dashboard Page
 *
 * Server component that resolves the Shopify session, queries aggregate
 * analytics metrics and per-quiz performance data from the database,
 * and renders stat cards + a top quizzes comparison table.
 *
 * Architecture:
 *   - Server: fetch aggregate + per-quiz stats via Prisma
 *   - Stat cards: inline Card components (same visual pattern as DashboardStats)
 *   - Top quizzes: simple HTML table (no shadcn/ui Table component needed)
 *   - Empty state when there is no data across any quiz
 */
import { cookies } from "next/headers";
import { getSessionFromCookie } from "../../../../lib/session";
import { getStore } from "../../../../lib/store";
import { env } from "../../../../lib/env";
import { prisma } from "../../../../lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart3,
  CheckCircle2,
  DollarSign,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
}

interface QuizStat {
  id: string;
  name: string;
  submissions: number;
  engagements: number;
  completions: number;
  completionRate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the store ID from the Shopify session cookie.
 * Returns `null` if the session is missing, invalid, or the store is not found.
 */
async function resolveStoreId(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore, env.SESSION_SECRET);
  if (!session) return null;
  const store = await getStore(prisma, session.shopifyDomain);
  return store?.id ?? null;
}

/**
 * Format a number as USD currency (no cents for whole dollars).
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a numeric rate as a whole-number percentage string (e.g. "42%").
 */
function formatPercent(rate: number): string {
  return `${Math.round(rate)}%`;
}

// ---------------------------------------------------------------------------
// Presentational components
// ---------------------------------------------------------------------------

function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
        <BarChart3 className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground font-medium">
          No analytics data yet
        </p>
        <p className="text-xs text-muted-foreground/70">
          Analytics will appear here once visitors start engaging with your
          published quizzes.
        </p>
      </CardContent>
    </Card>
  );
}

function TopQuizzesTable({ quizzes }: { quizzes: QuizStat[] }) {
  if (quizzes.length === 0) return <EmptyState />;

  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Quiz
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Engagements
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Completions
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Rate
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Submissions
              </th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((quiz, i) => (
              <tr
                key={quiz.id}
                className={cn(
                  "border-b last:border-b-0",
                  i % 2 === 0 && "bg-muted/20",
                )}
              >
                <td className="px-4 py-3 font-medium">{quiz.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {quiz.engagements.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {quiz.completions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPercent(quiz.completionRate)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {quiz.submissions.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

export default async function AnalyticsPage() {
  const storeId = await resolveStoreId();

  if (!storeId) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-6">Analytics</h1>
        <EmptyState />
      </div>
    );
  }

  const storeFilter = { storeId };

  // Run aggregate + lookup queries in parallel
  const [
    totalEngagements,
    totalCompletions,
    totalAddToCarts,
    orderAgg,
    quizList,
  ] = await Promise.all([
    prisma.analyticsEvent.count({
      where: { ...storeFilter, event: "quiz_started" },
    }),
    prisma.analyticsEvent.count({
      where: { ...storeFilter, event: "quiz_completed" },
    }),
    prisma.analyticsEvent.count({
      where: { ...storeFilter, event: "add_to_cart" },
    }),
    prisma.orderAttribution.aggregate({
      where: storeFilter,
      _sum: { orderTotal: true },
      _count: true,
    }),
    prisma.quiz.findMany({
      where: storeFilter,
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Run per-quiz grouped queries in a second parallel batch
  const [submissionCounts, startCounts, completeCounts] = await Promise.all([
    prisma.submission.groupBy({
      by: ["quizId"],
      where: storeFilter,
      _count: { id: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["quizId"],
      where: { ...storeFilter, event: "quiz_started" },
      _count: { id: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["quizId"],
      where: { ...storeFilter, event: "quiz_completed" },
      _count: { id: true },
    }),
  ]);

  // -----------------------------------------------------------------------
  // Build per-quiz stats
  // -----------------------------------------------------------------------

  function lookupCount(
    list: { quizId: string; _count: { id: number } }[],
    quizId: string,
  ): number {
    return list.find((r) => r.quizId === quizId)?._count.id ?? 0;
  }

  const quizStats: QuizStat[] = quizList.map((quiz) => {
    const engagements = lookupCount(startCounts, quiz.id);
    const completions = lookupCount(completeCounts, quiz.id);
    const submissions = lookupCount(submissionCounts, quiz.id);

    return {
      id: quiz.id,
      name: quiz.name,
      submissions,
      engagements,
      completions,
      completionRate:
        engagements > 0 ? (completions / engagements) * 100 : 0,
    };
  });

  // Sort by submission count descending
  quizStats.sort((a, b) => b.submissions - a.submissions);

  // -----------------------------------------------------------------------
  // Derived aggregate metrics
  // -----------------------------------------------------------------------

  const attributedOrders = orderAgg._count;
  const totalRevenue = orderAgg._sum.orderTotal ?? 0;
  const completionRate =
    totalEngagements > 0
      ? (totalCompletions / totalEngagements) * 100
      : 0;
  const averageOrderValue =
    attributedOrders > 0 ? totalRevenue / attributedOrders : 0;

  const isEmpty =
    totalEngagements === 0 &&
    totalCompletions === 0 &&
    totalAddToCarts === 0 &&
    totalRevenue === 0 &&
    quizStats.every((q) => q.submissions === 0);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Analytics</h1>

      {/* Stat cards grid (6 cards, 3 per row on large screens) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Engagements"
          value={totalEngagements.toLocaleString()}
          description="Quiz sessions started"
          icon={MousePointerClick}
        />
        <StatCard
          title="Total Completions"
          value={totalCompletions.toLocaleString()}
          description="Quizzes finished to a result"
          icon={CheckCircle2}
        />
        <StatCard
          title="Completion Rate"
          value={formatPercent(completionRate)}
          description="Completions ÷ engagements"
          icon={TrendingUp}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          description="Attributed order total"
          icon={DollarSign}
        />
        <StatCard
          title="Avg. Order Value"
          value={formatCurrency(averageOrderValue)}
          description="Revenue ÷ attributed orders"
          icon={DollarSign}
        />
        <StatCard
          title="Total Add-to-Carts"
          value={totalAddToCarts.toLocaleString()}
          description="Products added from results"
          icon={ShoppingCart}
        />
      </div>

      {/* Top quizzes section */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Top Quizzes
        </h2>
        {isEmpty ? (
          <EmptyState />
        ) : (
          <TopQuizzesTable quizzes={quizStats} />
        )}
      </section>
    </div>
  );
}
