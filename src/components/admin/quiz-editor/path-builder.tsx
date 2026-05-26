"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Loader2, GitBranch, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnswerSummary {
  id: string;
  title: string;
  questionId: string;
}

interface QuestionSummary {
  id: string;
  title: string;
  type: string;
  answers: AnswerSummary[];
}

interface ResultSummary {
  id: string;
  title: string;
  order: number;
}

interface PathAnswerData {
  id: string;
  questionId: string;
  answerId: string;
}

interface PathData {
  id: string;
  resultId: string;
  logicOperator: string;
  order: number;
  pathAnswers: PathAnswerData[];
  result?: ResultSummary;
}

interface FullQuizResponse {
  quiz: {
    questions: QuestionSummary[];
    results: ResultSummary[];
    resultPaths: PathData[];
  };
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready" };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function findQuestionTitle(
  questions: QuestionSummary[],
  questionId: string,
): string {
  return questions.find((q) => q.id === questionId)?.title ?? "Unknown Q";
}

function findAnswerTitle(
  questions: QuestionSummary[],
  questionId: string,
  answerId: string,
): string {
  return (
    questions
      .find((q) => q.id === questionId)
      ?.answers.find((a) => a.id === answerId)?.title ?? "Unknown A"
  );
}

/** Build a human-readable path preview: "IF Q1:A1 AND Q2:A3 → Result: Skinny Latte" */
function pathPreview(
  path: PathData,
  questions: QuestionSummary[],
): string {
  if (path.pathAnswers.length === 0) return "No conditions";
  const parts = path.pathAnswers.map(
    (pa) =>
      `${findQuestionTitle(questions, pa.questionId)}:${findAnswerTitle(questions, pa.questionId, pa.answerId)}`,
  );
  const cond = parts.join(` ${path.logicOperator} `);
  const label = path.result?.title ?? "?";
  return `IF ${cond} → ${label}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Loading skeleton for the path builder area. */
function BuilderSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-5 w-28 rounded bg-muted animate-pulse" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-24 rounded bg-muted/50 animate-pulse" />
      ))}
    </div>
  );
}

/** Error state with retry button. */
function BuilderError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive m-4">
      <CardContent className="py-6 text-center space-y-3">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

/** Empty state when no paths exist. */
function EmptyPaths() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center">
        <GitBranch className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No logic paths yet — map answers to results below
        </p>
      </CardContent>
    </Card>
  );
}

/** Delete confirmation for a single path. */
function DeletePathConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="flex items-center justify-between py-2 px-3">
        <p className="text-xs text-destructive">Delete this path and all its conditions?</p>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PathAnswerRow — single question→answer condition in a path
// ---------------------------------------------------------------------------

function PathAnswerRow({
  pa,
  questions,
  index,
  onUpdate,
  onRemove,
}: {
  pa: PathAnswerData;
  questions: QuestionSummary[];
  index: number;
  onUpdate: (data: { questionId?: string; answerId?: string }) => void;
  onRemove: () => void;
}) {
  const selectedQuestion = questions.find((q) => q.id === pa.questionId);
  const answers = selectedQuestion?.answers ?? [];

  return (
    <div className="flex items-start gap-2 rounded border bg-muted/30 p-2">
      {/* Index label */}
      <span className="text-xs text-muted-foreground pt-2 w-5 shrink-0 tabular-nums">
        {index + 1}.
      </span>

      {/* Question dropdown */}
      <div className="flex-1 min-w-0 space-y-1">
        <Select
          value={pa.questionId}
          onChange={(e) =>
            onUpdate({ questionId: e.target.value, answerId: undefined })
          }
          className="h-8 text-xs"
        >
          <option value="" disabled>
            Select question
          </option>
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </Select>

        {/* Answer dropdown — filtered by selected question */}
        {pa.questionId && answers.length > 0 && (
          <Select
            value={pa.answerId}
            onChange={(e) => onUpdate({ answerId: e.target.value })}
            className="h-8 text-xs"
          >
            <option value="" disabled>
              Select answer
            </option>
            {answers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
        )}

        {pa.questionId && answers.length === 0 && (
          <p className="text-xs text-muted-foreground pl-1">
            No answers for this question
          </p>
        )}
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PathCard — single path row
// ---------------------------------------------------------------------------

function PathCard({
  path,
  questions,
  results,
  onResultChange,
  onOperatorToggle,
  onAddAnswer,
  onUpdateAnswer,
  onRemoveAnswer,
  onDeletePath,
}: {
  path: PathData;
  questions: QuestionSummary[];
  results: ResultSummary[];
  onResultChange: (resultId: string) => void;
  onOperatorToggle: (operator: "AND" | "OR") => void;
  onAddAnswer: () => void;
  onUpdateAnswer: (idx: number, data: { questionId?: string; answerId?: string }) => void;
  onRemoveAnswer: (idx: number) => void;
  onDeletePath: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Target result */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Maps to Result
              </label>
              <Select
                value={path.resultId}
                onChange={(e) => onResultChange(e.target.value)}
                className="h-8 text-sm w-full"
              >
                <option value="" disabled>
                  Select a result outcome
                </option>
                {results.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </Select>
            </div>

            {/* AND / OR toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Operator:
              </span>
              <div className="flex rounded-md border border-input bg-muted/50 p-0.5">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                    path.logicOperator === "AND"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => onOperatorToggle("AND")}
                >
                  AND
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                    path.logicOperator === "OR"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => onOperatorToggle("OR")}
                >
                  OR
                </button>
              </div>
              {path.logicOperator === "AND" && (
                <span className="text-[10px] text-muted-foreground">
                  (all must match)
                </span>
              )}
              {path.logicOperator === "OR" && (
                <span className="text-[10px] text-muted-foreground">
                  (at least one)
                </span>
              )}
            </div>
          </div>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete path"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Conditions */}
        <div className="space-y-2">
          {path.pathAnswers.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No conditions — add at least one question→answer pair
            </p>
          )}

          {path.pathAnswers.map((pa, i) => (
            <PathAnswerRow
              key={`${pa.questionId}-${pa.answerId}-${i}`}
              pa={pa}
              questions={questions}
              index={i}
              onUpdate={(data) => onUpdateAnswer(i, data)}
              onRemove={() => onRemoveAnswer(i)}
            />
          ))}

          {/* Add condition */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={onAddAnswer}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Condition
          </Button>
        </div>

        {/* Path preview */}
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground break-all">
            {pathPreview(path, questions)}
          </p>
        </div>
      </CardContent>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="px-6 pb-4">
          <DeletePathConfirm
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={() => {
              setShowDeleteConfirm(false);
              onDeletePath();
            }}
          />
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component — PathBuilder
// ---------------------------------------------------------------------------

/**
 * PathBuilder — build AND/OR result path logic for Basic and Combination quizzes.
 *
 * Each path maps answer selections to a Result:
 *   - AND: user must select ALL answers in the path
 *   - OR: user must select AT LEAST ONE answer in the path
 *
 * Paths are evaluated in order — the first matching path wins.
 */
export function PathBuilder({ quizId }: { quizId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({ phase: "loading" });
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [results, setResults] = useState<ResultSummary[]>([]);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [savingPathId, setSavingPathId] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    setLoadState({ phase: "loading" });
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}`);
      if (!res.ok) throw new Error("Failed to load quiz data");
      const data = (await res.json()) as FullQuizResponse;
      setQuestions(data.quiz.questions);
      setResults(data.quiz.results);
      setPaths(data.quiz.resultPaths);
      setLoadState({ phase: "ready" });
    } catch (err) {
      setLoadState({
        phase: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [quizId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ------------------------------------------------------------------
  // Path CRUD
  // ------------------------------------------------------------------

  async function handleAddPath() {
    if (results.length === 0) return;
    setSavingPathId("__new__");
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/result-paths`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: results[0].id, logicOperator: "AND" }),
      });
      if (!res.ok) throw new Error("Failed to create path");
      const { path } = (await res.json()) as { path: PathData };
      setPaths((prev) => [...prev, { ...path, result: results[0] }]);
    } catch {
      // Silently handled — user can retry
    } finally {
      setSavingPathId(null);
    }
  }

  async function handleDeletePath(pathId: string) {
    setSavingPathId(pathId);
    try {
      const res = await fetch(`/api/admin/result-paths/${pathId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete path");
      setPaths((prev) => prev.filter((p) => p.id !== pathId));
    } catch {
      // Keep path visible if delete fails
    } finally {
      setSavingPathId(null);
    }
  }

  async function savePath(pathId: string, updates: {
    resultId?: string;
    logicOperator?: "AND" | "OR";
    answers?: { questionId: string; answerId: string }[];
  }) {
    setSavingPathId(pathId);
    try {
      const res = await fetch(`/api/admin/result-paths/${pathId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update path");
      const { path } = (await res.json()) as { path: PathData };
      setPaths((prev) =>
        prev.map((p) => (p.id === pathId ? { ...p, ...path } : p)),
      );
    } catch {
      // Keep local state on failure
    } finally {
      setSavingPathId(null);
    }
  }

  // ------------------------------------------------------------------
  // Path mutation helpers (delegates to savePath)
  // ------------------------------------------------------------------

  function handleResultChange(pathId: string, resultId: string) {
    const result = results.find((r) => r.id === resultId);
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pathId ? { ...p, resultId, result } : p,
      ),
    );
    savePath(pathId, { resultId });
  }

  function handleOperatorToggle(pathId: string, operator: "AND" | "OR") {
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pathId ? { ...p, logicOperator: operator } : p,
      ),
    );
    savePath(pathId, { logicOperator: operator });
  }

  function handleAddAnswer(pathId: string) {
    setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== pathId) return p;
        return {
          ...p,
          pathAnswers: [...p.pathAnswers, { id: "", questionId: "", answerId: "" }],
        };
      }),
    );
  }

  function handleUpdateAnswer(
    pathId: string,
    idx: number,
    data: { questionId?: string; answerId?: string },
  ) {
    setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== pathId) return p;
        const updated = [...p.pathAnswers];
        updated[idx] = { ...updated[idx], ...data };
        return { ...p, pathAnswers: updated };
      }),
    );

    // Persist only when both questionId and answerId are selected
    const path = paths.find((p) => p.id === pathId);
    if (!path) return;
    const answers = [...path.pathAnswers];
    answers[idx] = { ...answers[idx], ...data };
    const complete = answers.filter((a) => a.questionId && a.answerId);
    if (complete.length > 0) {
      savePath(pathId, {
        answers: complete.map((a) => ({
          questionId: a.questionId,
          answerId: a.answerId,
        })),
      });
    }
  }

  function handleRemoveAnswer(pathId: string, idx: number) {
    setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== pathId) return p;
        const updated = p.pathAnswers.filter((_, i) => i !== idx);
        return { ...p, pathAnswers: updated };
      }),
    );

    // Persist remaining answers
    const path = paths.find((p) => p.id === pathId);
    if (!path) return;
    const updated = path.pathAnswers.filter((_, i) => i !== idx);
    const complete = updated.filter((a) => a.questionId && a.answerId);
    savePath(pathId, {
      answers: complete.map((a) => ({
        questionId: a.questionId,
        answerId: a.answerId,
      })),
    });
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (loadState.phase === "loading") return <BuilderSkeleton />;
  if (loadState.phase === "error") {
    return <BuilderError message={loadState.message} onRetry={fetchAll} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">Result Paths</h3>
          <p className="text-xs text-muted-foreground">
            Map combinations of answers to result outcomes
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddPath}
          disabled={savingPathId === "__new__" || results.length === 0 || paths.length > 0}
        >
          {savingPathId === "__new__" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          )}
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Path
        </Button>
      </div>

      {/* Path list */}
      {paths.length === 0 ? (
        <EmptyPaths />
      ) : (
        <div className="space-y-4">
          {paths.map((path) => (
            <PathCard
              key={path.id}
              path={path}
              questions={questions}
              results={results}
              onResultChange={(resultId) => handleResultChange(path.id, resultId)}
              onOperatorToggle={(op) => handleOperatorToggle(path.id, op)}
              onAddAnswer={() => handleAddAnswer(path.id)}
              onUpdateAnswer={(idx, data) => handleUpdateAnswer(path.id, idx, data)}
              onRemoveAnswer={(idx) => handleRemoveAnswer(path.id, idx)}
              onDeletePath={() => handleDeletePath(path.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
