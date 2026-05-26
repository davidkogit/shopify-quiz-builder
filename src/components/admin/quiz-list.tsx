"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, FileText, Clock, ExternalLink, HelpCircle, Loader2 } from "lucide-react";
import type { Quiz } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Quiz enriched with question count from the API. */
type QuizWithCount = Quiz & { _count: { questions: number } };

interface QuizListProps {
  /** Increment to trigger a re-fetch from the API. */
  refreshKey?: number;
  /** Called when a quiz is successfully created or duplicated so the
   *  parent can increment refreshKey or take other actions. */
  onCreated?: () => void;
}

type ListState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "success"; quizzes: QuizWithCount[] };

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

function statusBadgeVariant(status: string) {
  return status === "published" ? ("success" as const) : ("secondary" as const);
}

function formatLogicType(t: string): string {
  const map: Record<string, string> = {
    basic: "Basic",
    single: "Single",
    points: "Points",
    productWeight: "Product Weight",
    resultWeight: "Result Weight",
    combination: "Combination",
  };
  return map[t] ?? t;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuizCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuizCard({
  quiz,
  onDuplicate,
}: {
  quiz: QuizWithCount;
  onDuplicate: (quizId: string) => Promise<void>;
}) {
  const questionCount = quiz._count.questions;
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = useCallback(async () => {
    setDuplicating(true);
    try {
      await onDuplicate(quiz.id);
    } finally {
      setDuplicating(false);
    }
  }, [quiz.id, onDuplicate]);

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">
          <Link
            href={`/quiz/${quiz.id}`}
            className="flex items-center gap-2 hover:underline"
          >
            {quiz.name}
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusBadgeVariant(quiz.status)}>
            {quiz.status === "published" ? "Published" : "Draft"}
          </Badge>
          <Badge variant="outline">{formatLogicType(quiz.logicType)}</Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              {questionCount} {questionCount === 1 ? "question" : "questions"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(quiz.updatedAt.toISOString())}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={handleDuplicate}
            disabled={duplicating}
            aria-label={`Duplicate ${quiz.name}`}
          >
            {duplicating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyQuizzes() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="max-w-sm space-y-1">
          <h3 className="text-lg font-semibold">No quizzes yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first product recommendation quiz to start capturing
            customer preferences and driving conversions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// QuizList
// ---------------------------------------------------------------------------

export function QuizList({ refreshKey = 0, onCreated }: QuizListProps) {
  const [state, setState] = useState<ListState>({ phase: "loading" });

  const fetchQuizzes = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/admin/quizzes");
      if (!res.ok) throw new Error("Failed to fetch quizzes");
      const data = (await res.json()) as { quizzes: QuizWithCount[] };
      setState({ phase: "success", quizzes: data.quizzes });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes, refreshKey]);

  const handleDuplicate = useCallback(
    async (quizId: string) => {
      const res = await fetch(`/api/admin/quizzes/${quizId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Failed to duplicate quiz");
      }
      // Refresh the list after successful duplication
      onCreated?.();
      fetchQuizzes();
    },
    [fetchQuizzes, onCreated],
  );

  // ---- Loading state ----
  if (state.phase === "loading") {
    return (
      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <QuizCardSkeleton />
        <QuizCardSkeleton />
        <QuizCardSkeleton />
      </div>
    );
  }

  // ---- Error state ----
  if (state.phase === "error") {
    return (
      <div className="mt-6 flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm text-destructive">{state.message}</p>
        <Button variant="outline" size="sm" onClick={fetchQuizzes}>
          Retry
        </Button>
      </div>
    );
  }

  // ---- Empty state ----
  if (state.quizzes.length === 0) {
    return (
      <div className="mt-6">
        <EmptyQuizzes />
      </div>
    );
  }

  // ---- Quiz cards ----
  return (
    <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {state.quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} onDuplicate={handleDuplicate} />
      ))}
    </div>
  );
}
