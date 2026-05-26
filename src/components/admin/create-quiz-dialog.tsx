"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Constants (pure data)
// ---------------------------------------------------------------------------

const LOGIC_TYPES = [
  { value: "basic", label: "Basic" },
  { value: "single", label: "Single" },
  { value: "points", label: "Points" },
  { value: "productWeight", label: "Product Weight" },
  { value: "resultWeight", label: "Result Weight" },
  { value: "combination", label: "Combination" },
] as const;

/** Pre-built quiz templates with default name and logic type. */
const TEMPLATES = [
  { value: "", label: "Blank quiz — start from scratch" },
  { value: "skincare", label: "Skincare Routine Builder", name: "Skincare Routine Builder", logicType: "basic" },
  { value: "coffee", label: "Coffee Finder", name: "Coffee Finder", logicType: "basic" },
  { value: "supplement", label: "Supplement Quiz", name: "Supplement Quiz", logicType: "points" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a quiz is created successfully. */
  onCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateQuizDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateQuizDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logicType, setLogicType] = useState("basic");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setLogicType("basic");
    setTemplate("");
    setError(null);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  /** Auto-fill name and logicType when a template is selected. */
  function handleTemplateChange(value: string) {
    setTemplate(value);
    setError(null);

    const tpl = TEMPLATES.find((t) => t.value === value);
    if (tpl && tpl.value !== "") {
      setName(tpl.name);
      setLogicType(tpl.logicType);
    }
    // Switching to blank does not clear the name — user can edit freely.
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (template) {
      // Template path — name/logicType come from template, no extra validation needed
      setError(null);
      setSubmitting(true);

      try {
        const res = await fetch("/api/admin/quizzes/from-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: template }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { error?: string })?.error ?? "Failed to create quiz from template",
          );
        }

        const data = (await res.json()) as { quiz: { id: string } };
        reset();
        onOpenChange(false);
        onCreated?.();
        router.push(`/quiz/${data.quiz.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Blank quiz path — name is required
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Quiz name is required.");
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        const res = await fetch("/api/admin/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, logicType }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { error?: string })?.error ?? "Failed to create quiz",
          );
        }

        const data = (await res.json()) as { quiz: { id: string } };
        reset();
        onOpenChange(false);
        onCreated?.();
        router.push(`/quiz/${data.quiz.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new quiz</DialogTitle>
          <DialogDescription>
            Start from a pre-built template or build your quiz from scratch.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            <Label htmlFor="quiz-template">Start from template</Label>
            <Select
              id="quiz-template"
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              disabled={submitting}
            >
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Quiz name */}
          <div className="space-y-2">
            <Label htmlFor="quiz-name">Quiz Name</Label>
            <Input
              id="quiz-name"
              placeholder="e.g. Skincare Finder"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required={!template}
            />
          </div>

          {/* Logic type */}
          <div className="space-y-2">
            <Label htmlFor="quiz-logic">Logic Type</Label>
            <Select
              id="quiz-logic"
              value={logicType}
              onChange={(e) => setLogicType(e.target.value)}
              disabled={submitting}
            >
              {LOGIC_TYPES.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {template ? "Create from Template" : "Create Quiz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
