"use client";

/**
 * QuizWidget — Client-side React state machine for the storefront quiz flow.
 *
 * Phases: loading → intro → question → email → submitting → results
 * Error state is reachable from any phase on fetch failure.
 *
 * Uses dedicated sub-components from widget-ui/ and question-renderers/.
 * Self-contained CSS via ./widget.css — no admin Tailwind dependencies.
 */
import { useState, useEffect, useCallback } from "react";
import "./widget.css";

// Widget UI sub-components
import { IntroPage } from "./widget-ui/intro-page";
import { ProgressBar } from "./widget-ui/progress-bar";
import { Navigation } from "./widget-ui/navigation";
import { EmailCapturePage } from "./widget-ui/email-capture-page";
import { ResultsPage } from "./widget-ui/results-page";

// Question type renderers
import { RadioQuestion } from "./question-renderers/radio-question";
import { ImageTextQuestion } from "./question-renderers/image-text-question";
import { TextBoxQuestion } from "./question-renderers/text-box-question";
import { RangeSliderQuestion } from "./question-renderers/range-slider-question";
import { SelectBoxQuestion } from "./question-renderers/select-box-question";

// ============================================================================
// Types
// ============================================================================

type Step = "loading" | "intro" | "question" | "email" | "submitting" | "results" | "error";

interface UserAnswer {
  questionId: string;
  answerIds: string[];
}

interface PublicAnswer {
  id: string;
  title: string;
  image: string | null;
  description: string | null;
  order: number;
  points: number;
  tags: unknown;
  leadsToQuestionId: string | null;
}

interface PublicQuestion {
  id: string;
  type: string;
  order: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  image: string | null;
  required: boolean;
  settings: unknown;
  answers: PublicAnswer[];
}

interface PublicResult {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  order: number;
  outcomeType: string;
  outcomeData: unknown;
  pointsFrom: number | null;
  pointsTo: number | null;
}

export interface QuizPublic {
  id: string;
  name: string;
  key: string;
  logicType: string;
  settings: Record<string, unknown>;
  discountCode: string | null;
  discountLabel: string | null;
  styles: Record<string, unknown>;
  questions: PublicQuestion[];
  results: PublicResult[];
}

interface RecommendedProduct {
  id: string;
  title: string;
  imageUrl: string;
  price: string;
}

interface SubmitResponse {
  submissionId: string;
  result: PublicResult | null;
  recommendedProducts: RecommendedProduct[];
}

// ============================================================================
// Pure helpers
// ============================================================================

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Client-side logic-jump resolution — mirrors resolveNextQuestion from lib/logic-engine.ts. */
function resolveNextQuestionLocal(
  currentId: string,
  selectedAnswerId: string,
  questions: PublicQuestion[],
): PublicQuestion | null {
  const idx = questions.findIndex((q) => q.id === currentId);
  if (idx === -1) return null;
  const answer = questions[idx].answers.find((a) => a.id === selectedAnswerId);
  if (answer?.leadsToQuestionId) {
    const target = questions.find((q) => q.id === answer.leadsToQuestionId);
    if (target) return target;
  }
  return questions[idx + 1] ?? null;
}

/** Fire-and-forget analytics tracking — non-blocking, swallows errors. */
function trackEvent(
  key: string,
  event: string,
  sessionId: string,
  meta?: { questionId?: string; answerId?: string },
): void {
  fetch(`/api/public/quiz/${key}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, event, ...meta }),
  }).catch(() => {
    /* analytics are best-effort */
  });
}

// ============================================================================
// Component
// ============================================================================

interface Props {
  quizKey: string;
}

export function QuizWidget({ quizKey }: Props) {
  // ---- State ----
  const [step, setStep] = useState<Step>("loading");
  const [quiz, setQuiz] = useState<QuizPublic | null>(null);
  const [questionPath, setQuestionPath] = useState<string[]>([]);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [sessionId] = useState(() => generateUUID());
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PublicResult | null>(null);
  const [products, setProducts] = useState<RecommendedProduct[]>([]);

  // ---- Derived ----
  const currentQuestionId =
    questionPath.length > 0 ? questionPath[questionPath.length - 1] : null;
  const currentQuestion = currentQuestionId
    ? quiz?.questions.find((q) => q.id === currentQuestionId) ?? null
    : null;
  const currentAnswer = currentQuestionId
    ? answers.find((a) => a.questionId === currentQuestionId)
    : undefined;
  const selectedAnswerId = currentAnswer?.answerIds[0] ?? null;
  const hasQuestions = (quiz?.questions.length ?? 0) > 0;
  const hasEmailCapture = Boolean(
    quiz?.settings?.emailCapture ?? quiz?.settings?.captureEmail ?? false,
  );

  // ---- Mount: fetch quiz config ----
  const fetchQuiz = useCallback(async () => {
    try {
      setStep("loading");
      setErrorMsg(null);
      const res = await fetch(`/api/public/quiz/${quizKey}`);
      if (!res.ok) throw new Error(res.status === 404 ? "Quiz not found" : "Failed to load quiz");
      const data = await res.json();
      if (!data.quiz) throw new Error("Invalid quiz data");
      setQuiz(data.quiz as QuizPublic);
      trackEvent(quizKey, "quiz_started", sessionId);
      setStep("intro");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }, [quizKey, sessionId]);

  useEffect(() => {
    void fetchQuiz();
  }, [fetchQuiz]);

  // ---- Navigation helpers ----
  const goToQuestion = useCallback(
    (next: PublicQuestion) => {
      setQuestionPath((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === next.id) return prev;
        return [...prev, next.id];
      });
      setStep("question");
    },
    [],
  );

  const handleStart = useCallback(() => {
    if (!quiz || !hasQuestions) return;
    goToQuestion(quiz.questions[0]);
  }, [quiz, hasQuestions, goToQuestion]);

  const handleSelectAnswer = useCallback(
    (questionId: string, answerId: string) => {
      setAnswers((prev) => {
        const existing = prev.findIndex((a) => a.questionId === questionId);
        if (existing === -1) return [...prev, { questionId, answerIds: [answerId] }];
        return prev.map((a, i) =>
          i === existing ? { ...a, answerIds: [answerId] } : a,
        );
      });
    },
    [],
  );

  // ---- Submit ----
  const submitAnswers = useCallback(async () => {
    if (!quiz) return;
    try {
      setStep("submitting");
      const res = await fetch(`/api/public/quiz/${quizKey}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answers,
          email: email || undefined,
          phone: phone || undefined,
          name: name || undefined,
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      const data = (await res.json()) as SubmitResponse;
      setResult(data.result);
      setProducts(data.recommendedProducts);
      trackEvent(quizKey, "quiz_completed", sessionId);
      setStep("results");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
      setStep("error");
    }
  }, [quiz, quizKey, sessionId, answers, email, phone, name]);

  const handleNext = useCallback(() => {
    if (!quiz || !currentQuestionId || !selectedAnswerId) return;
    trackEvent(quizKey, "question_answered", sessionId, {
      questionId: currentQuestionId,
      answerId: selectedAnswerId,
    });
    const next = resolveNextQuestionLocal(
      currentQuestionId,
      selectedAnswerId,
      quiz.questions,
    );
    if (next) {
      goToQuestion(next);
    } else if (hasEmailCapture) {
      setStep("email");
    } else {
      void submitAnswers();
    }
  }, [quiz, currentQuestionId, selectedAnswerId, goToQuestion, hasEmailCapture, quizKey, sessionId, submitAnswers]);

  const handlePrev = useCallback(() => {
    setQuestionPath((prev) => {
      if (prev.length <= 1) {
        setStep("intro");
        return [];
      }
      return prev.slice(0, -1);
    });
  }, []);

  const handleEmailSubmit = useCallback(
    (data: { email: string; name?: string; phone?: string }) => {
      setEmail(data.email);
      if (data.name !== undefined) setName(data.name);
      if (data.phone !== undefined) setPhone(data.phone);
      void submitAnswers();
    },
    [submitAnswers],
  );

  const canGoNext = currentQuestionId
    ? selectedAnswerId !== null
    : false;

  // ---- Derived for sub-components ----
  const isFirst = questionPath.length <= 1;
  const questionIndex = questionPath.length;
  const totalQuestions = quiz?.questions.length ?? 0;
  const introSubtitle = (quiz?.styles as Record<string, string>)?.introSubtitle;
  const introImage = (quiz?.styles as Record<string, string>)?.introImage;

  // ---- Render ----
  return (
    <div className="quiz-kit-widget">
      {step === "loading" && <LoadingSkeleton />}
      {step === "error" && (
        <ErrorState message={errorMsg ?? "Unknown error"} onRetry={fetchQuiz} />
      )}
      {step === "intro" && quiz && (
        <IntroPage
          title={quiz.name}
          subtitle={introSubtitle}
          imageUrl={introImage}
          onStart={handleStart}
        />
      )}
      {step === "question" && currentQuestion && quiz && (
        <QuestionRenderer
          question={currentQuestion}
          selectedAnswerId={selectedAnswerId}
          onSelect={(aid) => handleSelectAnswer(currentQuestion.id, aid)}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          canGoNext={canGoNext}
          onNext={handleNext}
          onPrev={handlePrev}
          isFirst={isFirst}
        />
      )}
      {step === "email" && (
        <EmailCapturePage
          onSubmit={handleEmailSubmit}
          requireEmail
        />
      )}
      {step === "submitting" && <SubmittingPlaceholder />}
      {step === "results" && (
        <ResultsPage
          result={result}
          products={products}
          totalQuestions={totalQuestions}
          quizKey={quizKey}
          sessionId={sessionId}
          discountCode={quiz?.discountCode ?? null}
          discountLabel={quiz?.discountLabel ?? null}
        />
      )}
    </div>
  );
}

// ============================================================================
// Question renderer dispatcher
// ============================================================================

interface QuestionRendererProps {
  question: PublicQuestion;
  selectedAnswerId: string | null;
  onSelect: (answerId: string) => void;
  questionIndex: number;
  totalQuestions: number;
  canGoNext: boolean;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
}

function QuestionRenderer({
  question,
  selectedAnswerId,
  onSelect,
  questionIndex,
  totalQuestions,
  canGoNext,
  onNext,
  onPrev,
  isFirst,
}: QuestionRendererProps) {
  const selectedIds = selectedAnswerId ? [selectedAnswerId] : [];
  const handleChange = (ids: string[]) => {
    if (ids.length > 0) onSelect(ids[0]);
  };

  // Choose renderer by question type
  const renderer = question.type === "imageText" ? (
    <ImageTextQuestion question={question} selectedAnswerIds={selectedIds} onChange={handleChange} />
  ) : question.type === "textBox" ? (
    <TextBoxQuestion question={question} selectedAnswerIds={selectedIds} onChange={handleChange} />
  ) : question.type === "rangeSlider" ? (
    <RangeSliderQuestion question={question} selectedAnswerIds={selectedIds} onChange={handleChange} />
  ) : question.type === "selectBox" ? (
    <SelectBoxQuestion question={question} selectedAnswerIds={selectedIds} onChange={handleChange} />
  ) : question.type === "fileUpload" ? (
    <p className="qk-intro-subtitle">File upload is not supported in the embedded widget.</p>
  ) : (
    <RadioQuestion question={question} selectedAnswerIds={selectedIds} onChange={handleChange} />
  );

  const stepLabel = `${questionIndex}/${totalQuestions}`;

  return (
    <div className="qk-page">
      <ProgressBar current={questionIndex} total={totalQuestions} />

      <span className="qk-question-label">
        Question {questionIndex} of {totalQuestions} &middot; {question.type}
      </span>
      <h3 className="qk-question-title">{question.title}</h3>
      {question.subtitle && (
        <p className="qk-question-subtitle">{question.subtitle}</p>
      )}

      {renderer}

      <Navigation
        onBack={onPrev}
        onNext={onNext}
        canGoBack={!isFirst}
        canGoNext={canGoNext}
        stepLabel={stepLabel}
      />
    </div>
  );
}

// ============================================================================
// Loading skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="qk-skeleton">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="qk-skeleton-line" />
      ))}
    </div>
  );
}

// ============================================================================
// Error state
// ============================================================================

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="qk-error-state">
      <p className="qk-error-msg">{message}</p>
      <button type="button" className="qk-btn-retry" onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// Submitting placeholder
// ============================================================================

function SubmittingPlaceholder() {
  return (
    <div className="qk-page qk-intro">
      <div className="qk-spinner" style={{ width: 32, height: 32, marginBottom: 16 }} />
      <p className="qk-intro-subtitle">Calculating your results…</p>
    </div>
  );
}
