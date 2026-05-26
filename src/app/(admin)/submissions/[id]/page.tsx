/**
 * Submission Detail Page
 *
 * Server component that fetches a single Submission by ID with related
 * Quiz name and Result data. Renders a full breakdown of the quiz response
 * including metadata, answer history, result, and recommended products.
 *
 * Architecture:
 *   - Server: resolve session, fetch submission via Prisma
 *   - Client island: BackButton (preserves filter state via router.back)
 *   - Loading state: loading.tsx (Suspense via Next.js route segment)
 */
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  User,
  Mail,
  Phone,
  Monitor,
  MapPin,
  Calendar,
  Hash,
  CheckCircle2,
  ShoppingBag,
  HelpCircle,
} from "lucide-react";
import { getSessionFromCookie } from "../../../../../lib/session";
import { getStore } from "../../../../../lib/store";
import { env } from "../../../../../lib/env";
import { prisma } from "../../../../../lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BackButton } from "@/components/admin/submissions/back-button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AnswerEntry {
  questionId: string;
  questionTitle: string;
  answerIds: string[];
  answerTitles: string[];
}

interface RecommendedProduct {
  id: string;
  title: string;
  imageUrl: string;
  price: string;
}

interface SubmissionDetail {
  id: string;
  quizName: string;
  sessionId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  answers: AnswerEntry[];
  result: {
    id: string;
    title: string;
    description: string | null;
    outcomeType: string;
    outcomeData: string;
  } | null;
  recommendedProducts: RecommendedProduct[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely parse a JSON string, returning a fallback on failure. */
function parseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Data fetching (server-side)
// ---------------------------------------------------------------------------

async function fetchSubmission(
  storeId: string,
  submissionId: string,
): Promise<SubmissionDetail | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      quiz: { select: { name: true } },
    },
  });

  if (!submission || submission.storeId !== storeId) return null;

  // Look up result by resultId if present
  const result = submission.resultId
    ? await prisma.result.findUnique({
        where: { id: submission.resultId },
        select: { id: true, title: true, description: true, outcomeType: true, outcomeData: true },
      })
    : null;

  return {
    id: submission.id,
    quizName: submission.quiz.name,
    sessionId: submission.sessionId,
    email: submission.email,
    phone: submission.phone,
    name: submission.name,
    ipAddress: submission.ipAddress,
    userAgent: submission.userAgent,
    createdAt: submission.createdAt,
    answers: parseJSON<AnswerEntry[]>(submission.answers, []),
    result,
    recommendedProducts: parseJSON<RecommendedProduct[]>(
      submission.recommendedProducts,
      [],
    ),
  };
}

// ---------------------------------------------------------------------------
// Section components (pure, presentational)
// ---------------------------------------------------------------------------

function MetadataField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm break-all">{value}</p>
      </div>
    </div>
  );
}

function OutcomeTypeBadge({ outcomeType }: { outcomeType: string }) {
  const variant = outcomeType === "product" ? "default" : "secondary";
  return (
    <Badge variant={variant} className="text-xs">
      {outcomeType}
    </Badge>
  );
}

function OutcomeDataBlock({ raw }: { raw: string }) {
  const parsed = parseJSON<unknown>(raw, null);
  if (!parsed || (typeof parsed === "object" && Object.keys(parsed as Record<string, unknown>).length === 0)) {
    return <p className="text-xs text-muted-foreground">No outcome data</p>;
  }
  return (
    <pre className="text-xs bg-muted rounded-md p-2 max-h-32 overflow-auto font-mono whitespace-pre-wrap">
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
}

function ProductCard({ product }: { product: RecommendedProduct }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.title}
          className="h-12 w-12 rounded-md object-cover shrink-0"
        />
      ) : (
        <div className="h-12 w-12 rounded-md bg-muted shrink-0 flex items-center justify-center">
          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {product.title || "Untitled product"}
        </p>
        <p className="text-xs text-muted-foreground">{product.price}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Resolve session & store
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore, env.SESSION_SECRET);

  if (!session) {
    return (
      <div>
        <BackButton />
        <h1 className="text-2xl font-bold tracking-tight mt-4">
          Submission Detail
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Please log in to view submissions.
        </p>
      </div>
    );
  }

  const store = await getStore(prisma, session.shopifyDomain);
  if (!store) {
    return (
      <div>
        <BackButton />
        <h1 className="text-2xl font-bold tracking-tight mt-4">
          Submission Detail
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Store not found.</p>
      </div>
    );
  }

  const submission = await fetchSubmission(store.id, id);
  if (!submission) notFound();

  const status = submission.result ? "completed" : "abandoned";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div className="space-y-1">
          <BackButton />
          <h1 className="text-2xl font-bold tracking-tight">
            Submission Detail
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            ID: {submission.id}
          </p>
        </div>
        <Badge variant={status === "completed" ? "success" : "secondary"}>
          {status === "completed" ? "Completed" : "Abandoned"}
        </Badge>
      </div>

      <Separator className="mb-6" />

      {/* Layout: sidebar + content on desktop, stacked on mobile */}
      <div className="flex flex-col lg:flex-row lg:gap-8">
        {/* Metadata sidebar — fixed width on desktop */}
        <aside className="lg:w-80 shrink-0 space-y-6 mb-6 lg:mb-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Quiz &amp; Date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetadataField
                icon={HelpCircle}
                label="Quiz"
                value={submission.quizName}
              />
              <MetadataField
                icon={Calendar}
                label="Submitted"
                value={formatDateTime(submission.createdAt)}
              />
              <MetadataField
                icon={Hash}
                label="Session ID"
                value={submission.sessionId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetadataField
                icon={User}
                label="Name"
                value={
                  submission.name || submission.email || "No contact info"
                }
              />
              <MetadataField
                icon={Mail}
                label="Email"
                value={submission.email}
              />
              <MetadataField
                icon={Phone}
                label="Phone"
                value={submission.phone}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Device</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetadataField
                icon={MapPin}
                label="IP Address"
                value={submission.ipAddress}
              />
              <MetadataField
                icon={Monitor}
                label="User Agent"
                value={submission.userAgent}
              />
            </CardContent>
          </Card>
        </aside>

        {/* Main content — takes remaining space */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Answer History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                Answer History
                <span className="text-sm font-normal text-muted-foreground">
                  ({submission.answers.length}{" "}
                  {submission.answers.length === 1 ? "question" : "questions"})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submission.answers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No answers recorded.
                </p>
              ) : (
                <div className="space-y-4">
                  {submission.answers.map((entry, i) => (
                    <div
                      key={entry.questionId}
                      className="p-3 rounded-md bg-muted/50"
                    >
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground">
                          Q{i + 1}.
                        </span>{" "}
                        {entry.questionTitle || "Untitled question"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {entry.answerTitles.map((title, j) => (
                          <Badge
                            key={`${entry.answerIds[j] ?? j}-${j}`}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {title || "Untitled answer"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result — only shown when a result is linked */}
          {submission.result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">
                    {submission.result.title}
                  </h3>
                  {submission.result.description && (
                    <p className="text-sm text-muted-foreground">
                      {submission.result.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Outcome Type
                    </p>
                    <OutcomeTypeBadge
                      outcomeType={submission.result.outcomeType}
                    />
                  </div>
                  <div className="space-y-1 min-w-[200px]">
                    <p className="text-xs text-muted-foreground">
                      Outcome Data
                    </p>
                    <OutcomeDataBlock raw={submission.result.outcomeData} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                Recommended Products
                <span className="text-sm font-normal text-muted-foreground">
                  ({submission.recommendedProducts.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submission.recommendedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No product recommendations for this submission.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {submission.recommendedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
