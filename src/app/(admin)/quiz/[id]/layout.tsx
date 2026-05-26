/**
 * Quiz Editor — Three-Column Layout
 *
 * Wraps inside the (admin) route group's AdminShell (sidebar + header).
 * This layout adds the editor's own three-column structure:
 *
 *   Desktop (md+):  Sidebar (240px) | Preview (flex-1) | Settings (320px)
 *   Mobile  (<md):  Single-column with bottom tab bar
 *
 * The children (page.tsx) render inside the Settings panel.
 */
import { Suspense } from "react";
import { QuizEditorMobile } from "@/components/admin/quiz-editor-mobile";
import { PreviewPanel } from "@/components/admin/quiz-editor/preview-panel";
import { QuizEditorSidebar } from "@/components/admin/quiz-editor/sidebar";
import prisma from "@/lib/prisma";
import { getQuizFull } from "@/lib/quiz-service";
import { safeJsonParse } from "@/lib/json-utils";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default async function QuizEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch quiz data for the preview panel
  const quiz = await getQuizFull(prisma, id);
  const settings = safeJsonParse(quiz?.settings ?? null, {} as Record<string, unknown>);
  const questions = (quiz?.questions ?? []).map((q) => ({
    id: q.id,
    type: q.type,
    title: q.title,
    subtitle: q.subtitle,
    answers: q.answers.map((a) => ({ id: a.id, title: a.title, leadsToQuestionId: a.leadsToQuestionId })),
  }));
  const results = (quiz?.results ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    outcomeType: r.outcomeType,
  }));

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      {/* ================================================================ */}
      {/* Desktop — three-column grid                                      */}
      {/* ================================================================ */}
      <div className="hidden md:grid md:grid-cols-[240px_1fr_320px] h-full -m-4 md:-m-6 lg:-m-8">
        {/* ---- Left: Page-type sidebar ---- */}
        <aside className="overflow-y-auto border-r bg-background p-4">
          <Suspense fallback={<div className="h-10 rounded bg-muted animate-pulse" />}>
            <QuizEditorSidebar quizId={id} />
          </Suspense>
        </aside>

        {/* ---- Center: Live preview panel ---- */}
        <section className="overflow-y-auto bg-muted/30 flex flex-col items-center p-6">
          <div className="w-full sticky top-6">
            <PreviewPanel
              quizName={quiz?.name ?? "Untitled Quiz"}
              introSettings={{
                subtitle: settings.subtitle as string | undefined,
                description: settings.description as string | undefined,
                image: settings.image as string | undefined,
              }}
              questions={questions}
              results={results}
            />
          </div>
        </section>

        {/* ---- Right: Settings panel (children) ---- */}
        <section className="overflow-y-auto border-l bg-background">
          {children}
        </section>
      </div>

      {/* ================================================================ */}
      {/* Mobile — single column with bottom tabs                          */}
      {/* ================================================================ */}
      <QuizEditorMobile quizId={id} className="h-full md:hidden">
        {children}
      </QuizEditorMobile>
    </div>
  );
}
