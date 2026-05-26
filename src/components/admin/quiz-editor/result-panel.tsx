"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ResultEditor } from "./result-editor";

/**
 * ResultPanel — thin wrapper that fetches the quiz's logicType before
 * rendering the ResultEditor so it knows whether to show Points fields.
 */
export function ResultPanel({
  quizId,
  resultId,
}: {
  quizId: string;
  resultId: string;
}) {
  const [logicType, setLogicType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/quizzes/${quizId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load quiz");
        return r.json() as Promise<{ quiz: { logicType: string } }>;
      })
      .then((data) => {
        if (!cancelled) setLogicType(data.quiz.logicType);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (logicType === null) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ResultEditor quizId={quizId} resultId={resultId} logicType={logicType} />
  );
}
