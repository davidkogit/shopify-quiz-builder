"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizList } from "@/components/admin/quiz-list";
import { CreateQuizDialog } from "@/components/admin/create-quiz-dialog";

// ---------------------------------------------------------------------------
// DashboardQuizzesSection
//
// Client-component island that manages the "Create Quiz" dialog and the
// QuizList refresh lifecycle.  Everything interactive lives here so the
// parent page can remain an async server component.
// ---------------------------------------------------------------------------

export function DashboardQuizzesSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">My Quizzes</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Quiz
        </Button>
      </div>

      <QuizList refreshKey={refreshKey} />

      <CreateQuizDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </section>
  );
}
