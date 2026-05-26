"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewQuestion {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  answers: PreviewAnswer[];
}

interface PreviewAnswer {
  id: string;
  title: string;
  leadsToQuestionId?: string | null;
}

interface PreviewResult {
  id: string;
  title: string;
  description?: string | null;
  outcomeType: string;
}

interface PreviewPanelProps {
  quizName: string;
  introSettings?: { subtitle?: string; description?: string; image?: string };
  questions: PreviewQuestion[];
  results: PreviewResult[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUESTION_TYPE_LABELS: Record<string, string> = {
  radio: "Radio",
  imageText: "Image + Text",
  textBox: "Text Box",
  rangeSlider: "Range",
  selectBox: "Select",
  fileUpload: "File Upload",
};

// ---------------------------------------------------------------------------
// Helpers (pure, client-side logic jump resolution)
// ---------------------------------------------------------------------------

/**
 * Resolve the next question after a selected answer, mirroring
 * resolveNextQuestion in lib/logic-engine.ts but operating on
 * the preview data already loaded into memory.
 */
function resolveNextQuestionLocal(
  currentQuestionId: string,
  selectedAnswerId: string,
  questions: PreviewQuestion[],
): PreviewQuestion | null {
  const currentIdx = questions.findIndex((q) => q.id === currentQuestionId);
  if (currentIdx === -1) return null;

  const question = questions[currentIdx];
  const answer = question.answers.find((a) => a.id === selectedAnswerId);

  // Logic jump: follow explicit target
  if (answer?.leadsToQuestionId) {
    const target = questions.find((q) => q.id === answer.leadsToQuestionId);
    if (target) return target;
    // Non-existent target — fall through to order-based
  }

  // Default: next question by original order
  return questions[currentIdx + 1] ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "intro" | "question" | "results";

export function PreviewPanel({
  quizName,
  introSettings,
  questions,
  results,
}: PreviewPanelProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [questionPath, setQuestionPath] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  const currentQuestionId = questionPath.length > 0 ? questionPath[questionPath.length - 1] : null;
  const currentQuestion = currentQuestionId
    ? questions.find((q) => q.id === currentQuestionId) ?? null
    : null;
  const selectedAnswerId = currentQuestionId ? selectedAnswers[currentQuestionId] ?? null : null;

  const goNext = useCallback(() => {
    if (phase === "intro") {
      if (questions.length === 0) return;
      const firstId = questions[0].id;
      setQuestionPath([firstId]);
      setPhase("question");
      return;
    }

    if (phase === "question" && currentQuestionId && selectedAnswerId) {
      const next = resolveNextQuestionLocal(
        currentQuestionId,
        selectedAnswerId,
        questions,
      );
      if (next) {
        setQuestionPath((p) => [...p, next.id]);
      } else {
        setPhase("results");
      }
    }
  }, [phase, currentQuestionId, selectedAnswerId, questions]);

  const goPrev = () => {
    if (phase === "results") {
      setPhase("question");
      return;
    }
    if (phase === "question") {
      if (questionPath.length <= 1) {
        setQuestionPath([]);
        setPhase("intro");
      } else {
        setQuestionPath((p) => p.slice(0, -1));
      }
    }
  };

  const reset = () => {
    setPhase("intro");
    setQuestionPath([]);
    setSelectedAnswers({});
  };

  const selectAnswer = (questionId: string, answerId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answerId }));
  };

  const isEmpty = questions.length === 0;

  // Compute path-based step index for progress dots
  const pathLength = questionPath.length;
  const totalPathSteps = 1 + questions.length + (results.length > 0 ? 1 : 0);

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Phone frame */}
      <div className="overflow-hidden rounded-3xl border-2 shadow-lg bg-background">
        {/* Mock status bar */}
        <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-[10px] text-muted-foreground font-medium">
            Preview
          </span>
        </div>

        {/* Content area */}
        <div className="p-5 min-h-[380px] flex flex-col">
          {isEmpty ? (
            <EmptyState />
          ) : (
            <>
              <StepContent
                phase={phase}
                currentQuestion={currentQuestion}
                questions={questions}
                selectedAnswerId={selectedAnswerId}
                onSelectAnswer={selectAnswer}
                quizName={quizName}
                introSettings={introSettings}
                results={results}
                questionPath={questionPath}
              />
              <NavBar
                phase={phase}
                pathLength={pathLength}
                totalPathSteps={totalPathSteps}
                canGoNext={
                  phase === "intro" ||
                  (phase === "question" && selectedAnswerId !== null)
                }
                isLast={phase === "results"}
                onNext={goNext}
                onPrev={goPrev}
                onReset={reset}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
      <div className="rounded-full bg-muted p-4">
        <Eye className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Add questions to see a preview
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step router
// ---------------------------------------------------------------------------

interface StepContentProps {
  phase: Phase;
  currentQuestion: PreviewQuestion | null;
  questions: PreviewQuestion[];
  selectedAnswerId: string | null;
  onSelectAnswer: (questionId: string, answerId: string) => void;
  quizName: string;
  introSettings?: PreviewPanelProps["introSettings"];
  results: PreviewResult[];
  questionPath: string[];
}

function StepContent({
  phase,
  currentQuestion,
  questions,
  selectedAnswerId,
  onSelectAnswer,
  quizName,
  introSettings,
  results,
  questionPath,
}: StepContentProps) {
  if (phase === "intro") {
    return <IntroPage name={quizName} settings={introSettings} />;
  }

  if (phase === "results") {
    return <ResultsPage results={results} questions={questions} path={questionPath} />;
  }

  if (currentQuestion) {
    // Compute display index from the path (how many unique questions visited, for numbering)
    const displayIndex = questionPath.length; // 1-based since path already includes current
    return (
      <QuestionPage
        question={currentQuestion}
        index={displayIndex}
        selectedAnswerId={selectedAnswerId}
        onSelect={(answerId) => onSelectAnswer(currentQuestion.id, answerId)}
        allQuestions={questions}
      />
    );
  }

  // Fallback (should not reach)
  return <IntroPage name={quizName} settings={introSettings} />;
}

// ---------------------------------------------------------------------------
// Intro page
// ---------------------------------------------------------------------------

function IntroPage({
  name,
  settings,
}: {
  name: string;
  settings?: PreviewPanelProps["introSettings"];
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
      {settings?.image && (
        <img
          src={settings.image}
          alt=""
          className="w-20 h-20 rounded-lg object-cover"
        />
      )}
      <h2 className="text-xl font-bold tracking-tight">{name}</h2>
      {settings?.subtitle && (
        <p className="text-sm text-muted-foreground">{settings.subtitle}</p>
      )}
      {settings?.description && (
        <p className="text-xs text-muted-foreground">{settings.description}</p>
      )}
      <span className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
        Start Quiz
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question page
// ---------------------------------------------------------------------------

function QuestionPage({
  question,
  index,
  selectedAnswerId,
  onSelect,
  allQuestions,
}: {
  question: PreviewQuestion;
  index: number;
  selectedAnswerId: string | null;
  onSelect: (answerId: string) => void;
  allQuestions: PreviewQuestion[];
}) {
  return (
    <div className="flex-1 flex flex-col gap-4">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Question {index} &middot;{" "}
        {QUESTION_TYPE_LABELS[question.type] ?? question.type}
      </span>
      <h3 className="text-base font-semibold">{question.title}</h3>
      {question.subtitle && (
        <p className="text-xs text-muted-foreground -mt-2">
          {question.subtitle}
        </p>
      )}
      <div className="space-y-2 mt-2">
        {question.answers.map((a) => {
          const isSelected = a.id === selectedAnswerId;
          const targetQuestion = a.leadsToQuestionId
            ? allQuestions.find((q) => q.id === a.leadsToQuestionId)
            : null;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm text-left cursor-pointer transition-colors w-full",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full border-2 shrink-0 transition-colors",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40",
                )}
              />
              <div className="flex-1 min-w-0">
                <span className="block truncate">{a.title}</span>
                {a.leadsToQuestionId && targetQuestion && (
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    ↳ Jumps to: {targetQuestion.title}
                  </span>
                )}
                {a.leadsToQuestionId && !targetQuestion && (
                  <span className="block text-[10px] text-destructive mt-0.5">
                    ↳ Missing target question
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results page
// ---------------------------------------------------------------------------

function ResultsPage({
  results,
  questions,
  path,
}: {
  results: PreviewResult[];
  questions: PreviewQuestion[];
  path: string[];
}) {
  return (
    <div className="flex-1 flex flex-col gap-3">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Results ({results.length})
      </span>

      {/* Path taken summary */}
      {path.length > 0 && (
        <div className="rounded-lg border border-dashed p-2 text-[10px] text-muted-foreground">
          <span className="font-medium">Path taken: </span>
          {path.map((id, i) => {
            const q = questions.find((q_) => q_.id === id);
            const label = q ? q.title : `(removed)`;
            return (
              <span key={id}>
                {i > 0 && " → "}
                <span className="font-medium">{label}</span>
              </span>
            );
          })}
        </div>
      )}

      {results.map((r) => (
        <div key={r.id} className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{r.title}</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase">
              {r.outcomeType}
            </span>
          </div>
          {r.description && (
            <p className="text-xs text-muted-foreground">{r.description}</p>
          )}
        </div>
      ))}
      {/* Placeholder product cards */}
      {results.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="h-16 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="h-16 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation bar
// ---------------------------------------------------------------------------

interface NavBarProps {
  phase: Phase;
  pathLength: number;
  totalPathSteps: number;
  canGoNext: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
}

function NavBar({
  phase,
  pathLength,
  totalPathSteps,
  canGoNext,
  isLast,
  onNext,
  onPrev,
  onReset,
}: NavBarProps) {
  const isIntro = phase === "intro";
  const currentDot = isIntro ? 0 : isLast ? totalPathSteps - 1 : 1 + pathLength;

  return (
    <div className="mt-auto pt-4 border-t">
      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mb-3">
        {Array.from({ length: totalPathSteps }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === currentDot
                ? "w-4 bg-primary"
                : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset preview"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={isIntro}
            aria-label="Previous step"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isLast}
            aria-label="Next step"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-[10px] text-muted-foreground font-medium min-w-[2rem] text-center tabular-nums">
          {currentDot + 1}/{totalPathSteps}
        </span>
      </div>
    </div>
  );
}
