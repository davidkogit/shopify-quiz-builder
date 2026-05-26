/**
 * Quiz Editor — Settings Panel
 *
 * Shown inside the right column (desktop) or settings tab (mobile).
 * Routes to the right editor based on search params:
 * - `?questionId=...` → QuestionEditor for that question
 * - `?resultId=...` → ResultEditorWrapper (client component) for that result
 * - `?tab=settings|styles|publish` → corresponding editor
 * - Default → prompt to select a page type
 */
import prisma from "@/lib/prisma";
import { QuestionEditor } from "@/components/admin/quiz-editor/question-editor";
import { ResultPanel } from "@/components/admin/quiz-editor/result-panel";
import { QuizSettings } from "@/components/admin/quiz-editor/quiz-settings";
import { StyleEditor } from "@/components/admin/quiz-editor/style-editor";
import { PublishEditor } from "@/components/admin/quiz-editor/publish-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function QuizEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; questionId?: string; resultId?: string }>;
}) {
  const { id } = await params;
  const { tab, questionId, resultId } = await searchParams;

  // Fetch quiz metadata (server-side, lightweight query)
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: { logicType: true, styles: true, key: true, status: true, abTestId: true, name: true },
  });
  const logicType = quiz?.logicType ?? "basic";

  // If quiz has an abTestId, find the linked variant quiz's key
  let variantQuizKey: string | null = null;
  if (quiz?.abTestId) {
    const variant = await prisma.quiz.findFirst({
      where: { abTestId: quiz.abTestId, id: { not: id } },
      select: { key: true },
    });
    variantQuizKey = variant?.key ?? null;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          {questionId
            ? "Edit Question"
            : resultId
              ? "Edit Result"
              : tab
                ? `${tab.charAt(0).toUpperCase() + tab.slice(1)}`
                : "Quiz Editor"}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">ID: {id}</p>
      </div>

      <Separator />

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {questionId ? (
          <QuestionEditor quizId={id} questionId={questionId} logicType={logicType} />
        ) : resultId ? (
          <ResultPanel quizId={id} resultId={resultId} />
        ) : tab === "settings" ? (
          <div className="p-6">
            <QuizSettings quizId={id} initialLogicType={logicType} />
          </div>
        ) : tab === "styles" ? (
          <div className="p-6">
            <StyleEditor quizId={id} initialStyles={quiz?.styles ?? "{}"} />
          </div>
        ) : tab === "publish" ? (
          <div className="p-6">
            <PublishEditor quizId={id} quizKey={quiz?.key ?? ""} initialStatus={quiz?.status ?? "draft"} abTestId={quiz?.abTestId ?? null} variantQuizKey={null} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-xs space-y-3">
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    Select a question or page to edit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Choose a page type from the sidebar to start building your
                    quiz. Pages include intro, questions, results, and more.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
