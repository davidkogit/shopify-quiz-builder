import Link from "next/link";
import { ChevronRight, FileText, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmissionRow {
  id: string;
  quizId: string;
  quizName: string;
  email: string | null;
  name: string | null;
  sessionId: string;
  createdAt: string; // ISO string
  resultTitle: string | null;
  productCount: number;
  status: "completed" | "abandoned";
}

export interface SubmissionsTableProps {
  submissions: SubmissionRow[];
  page: number;
  totalPages: number;
  total: number;
  /** Current search params for preserving filters in pagination links. */
  searchParams: Record<string, string | undefined>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayName(name: string | null, email: string | null): string {
  return name || email || "Anonymous";
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}

function Pagination({
  page,
  totalPages,
  total,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/submissions${qs ? `?${qs}` : ""}`;
  };

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </p>
      <div className="flex gap-1">
        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              className="h-8 w-8 p-0"
              asChild
            >
              <Link href={buildHref(p)}>{p}</Link>
            </Button>
          ),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="max-w-sm space-y-1">
          <h3 className="text-lg font-semibold">No submissions found</h3>
          <p className="text-sm text-muted-foreground">
            Submissions will appear here when customers complete your quizzes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Desktop Table
// ---------------------------------------------------------------------------

function DesktopTable({
  submissions,
  page,
  totalPages,
  total,
  searchParams,
}: SubmissionsTableProps) {
  return (
    <div className="hidden md:block">
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Quiz
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Customer
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Result
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr
                key={s.id}
                className="border-b transition-colors hover:bg-muted/50"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium">{formatDate(s.createdAt)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(s.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[160px] truncate">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{s.quizName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate">
                  <div className="font-medium truncate">
                    {displayName(s.name, s.email)}
                  </div>
                  {s.email && (
                    <div className="text-xs text-muted-foreground truncate">
                      {s.email}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge
                    variant={
                      s.status === "completed" ? "success" : "secondary"
                    }
                  >
                    {s.status === "completed" ? "Completed" : "Abandoned"}
                  </Badge>
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate text-muted-foreground">
                  {s.resultTitle ?? "—"}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <Link href={`/submissions/${s.id}`}>
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">View submission</span>
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={searchParams}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Cards
// ---------------------------------------------------------------------------

function MobileCards({
  submissions,
  page,
  totalPages,
  total,
  searchParams,
}: SubmissionsTableProps) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {submissions.map((s) => (
        <Link key={s.id} href={`/submissions/${s.id}`}>
          <Card className="transition-shadow hover:shadow-sm">
            <CardContent className="flex items-start justify-between p-4">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      s.status === "completed" ? "success" : "secondary"
                    }
                    className="shrink-0"
                  >
                    {s.status === "completed" ? "Completed" : "Abandoned"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(s.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">
                  {displayName(s.name, s.email)}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.quizName}</span>
                </div>
                {s.resultTitle && (
                  <p className="text-xs text-muted-foreground truncate">
                    Result: {s.resultTitle}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground self-center" />
            </CardContent>
          </Card>
        </Link>
      ))}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={searchParams}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Table Component
// ---------------------------------------------------------------------------

export function SubmissionsTable(props: SubmissionsTableProps) {
  if (props.submissions.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <DesktopTable {...props} />
      <MobileCards {...props} />
    </>
  );
}
