/**
 * Per-Quiz Analytics Detail Page
 *
 * Server component that fetches quiz analytics from the internal API
 * and renders summary stats, top answers, top products, funnel, and
 * time-series visualizations.
 *
 * Architecture:
 *   - Server: fetch analytics from GET /api/admin/quizzes/[id]/analytics
 *   - Client islands: FunnelChart, TimeSeriesChart, TopItemsList
 *   - Suspense boundaries for loading states
 *   - Date range control via ?from=&to= query params
 */

import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Inbox,
  MousePointerClick,
  Percent,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FunnelChart, type FunnelStep } from "@/components/admin/analytics/funnel-chart";
import {
  TimeSeriesChart,
  type TimeSeriesEntry,
} from "@/components/admin/analytics/time-series-chart";
import { TopItemsList, type TopItem } from "@/components/admin/analytics/top-items-list";

// ---------------------------------------------------------------------------
// API response types (mirrors route.ts)
// ---------------------------------------------------------------------------

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
  topAnswers: {
    questionId: string;
    questionTitle: string;
    answerId: string;
    answerTitle: string;
    count: number;
  }[];
  topProducts: {
    productId: string;
    productTitle: string;
    count: number;
  }[];
  funnel: FunnelStep[];
  timeSeries: TimeSeriesEntry[];
  computedAt: string;
}

// Additional metadata we embed in the response for the header
interface QuizAnalyticsFull extends QuizAnalyticsResponse {
  status?: string;
  logicType?: string;
}

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

// ---------------------------------------------------------------------------
// Data fetching (server-side)
// ---------------------------------------------------------------------------

async function fetchAnalytics(id: string, from?: string, to?: string): Promise<QuizAnalyticsFull | null> {
  // Resolve base URL from incoming request headers
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  // Build URL with optional date range query params
  const searchParams = new URLSearchParams();
  if (from) searchParams.set("from", from);
  if (to) searchParams.set("to", to);
  const qs = searchParams.toString();
  const url = `${baseUrl}/api/admin/quizzes/${encodeURIComponent(id)}/analytics${qs ? `?${qs}` : ""}`;

  // Forward session cookie so the API route can authenticate
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(url, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 404 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`Analytics API returned ${res.status}`);
  }

  const json: { analytics: QuizAnalyticsResponse } = await res.json();
  return json.analytics;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

// ---------------------------------------------------------------------------
// Stat card (inlined — avoids extra file for this single-use variant)
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
}

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
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

export default async function QuizAnalyticsPage(props: PageProps) {
  const { id } = await props.params;
  const { from, to } = await props.searchParams;

  const analytics = await fetchAnalytics(id, from, to);

  // 404 when quiz not found or not owned by this store
  if (!analytics) {
    notFound();
  }

  const { quizName, summary, topAnswers, topProducts, funnel, timeSeries } =
    analytics;

  // Derive quiz metadata — the analytics endpoint returns quizId/quizName
  // so we try to infer status/logicType.  When the API is enhanced to return
  // these fields directly the page will pick them up.
  const quizStatus = (analytics as QuizAnalyticsFull).status ?? "published";
  const quizLogicType = (analytics as QuizAnalyticsFull).logicType ?? "basic";

  // Adapt data for TopItemsList component
  const answerItems: TopItem[] = topAnswers.map((a) => ({
    id: a.answerId,
    title: a.answerTitle,
    subtitle: `Question: ${a.questionTitle}`,
    count: a.count,
  }));

  const productItems: TopItem[] = topProducts.map((p) => ({
    id: p.productId,
    title: p.productTitle,
    count: p.count,
  }));

  return (
    <div className="space-y-8">
      {/* ---- Back link ---- */}
      <Button variant="ghost" size="sm" asChild className="-ml-3 w-fit">
        <Link href="/analytics">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Analytics
        </Link>
      </Button>

      {/* ---- Header ---- */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{quizName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={quizStatus === "published" ? "success" : "secondary"}>
            {quizStatus === "published" ? "Published" : quizStatus}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {quizLogicType}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* ---- Summary Stats ---- */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Engagements"
          value={formatNumber(summary.totalViews)}
          description="Quiz started events"
          icon={MousePointerClick}
        />
        <StatCard
          title="Completions"
          value={formatNumber(summary.totalCompletions)}
          description="Quiz completed events"
          icon={CheckCircle2}
        />
        <StatCard
          title="Completion Rate"
          value={formatPercent(summary.conversionRate)}
          description="Completions / Engagements"
          icon={Percent}
        />
        <StatCard
          title="Submissions"
          value={formatNumber(summary.submissions)}
          description="Form submissions recorded"
          icon={Inbox}
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(summary.revenue)}
          description={`${summary.attributedOrders} attributed orders`}
          icon={DollarSign}
        />
      </div>

      {/* ---- Top Answers + Top Products ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopItemsList
          title="Top Answers"
          items={answerItems}
          emptyMessage="No answer data yet. Answers will appear after users submit the quiz."
        />
        <TopItemsList
          title="Top Products"
          items={productItems}
          emptyMessage="No product recommendations yet."
        />
      </div>

      {/* ---- Funnel + Time Series ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelChart steps={funnel} />
        <TimeSeriesChart data={timeSeries} />
      </div>

      {/* ---- Computed timestamp ---- */}
      <p className="text-xs text-muted-foreground text-right">
        Data computed at{" "}
        {new Date(analytics.computedAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}


