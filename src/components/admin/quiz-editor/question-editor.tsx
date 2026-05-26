"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AnswerEditor } from "./answer-editor";

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

const QUESTION_TYPES = [
  { value: "radio", label: "Radio" },
  { value: "imageText", label: "Image + Text" },
  { value: "textBox", label: "Text Box" },
  { value: "rangeSlider", label: "Range Slider" },
  { value: "selectBox", label: "Select Box" },
  { value: "fileUpload", label: "File Upload" },
] as const;

interface QuestionData {
  id: string; type: string; title: string;
  subtitle: string | null; description: string | null;
  image: string | null; required: boolean;
}

interface FormState {
  type: string; title: string; subtitle: string;
  description: string; image: string; required: boolean;
}

const BLANK_FORM: FormState = {
  type: "radio", title: "", subtitle: "",
  description: "", image: "", required: false,
};

function toFormState(q: QuestionData): FormState {
  return {
    type: q.type, title: q.title,
    subtitle: q.subtitle ?? "", description: q.description ?? "",
    image: q.image ?? "", required: q.required,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Loading skeleton shown while fetching question data. */
function EditorSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-5 w-24 rounded bg-muted animate-pulse" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted animate-pulse" />
          <div className="h-10 w-full rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Error display when question fetch fails entirely. */
function EditorError({ error, quizId }: { error: string; quizId: string }) {
  const router = useRouter();
  return (
    <div className="p-6">
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-4"
            onClick={() => router.push(`/quiz/${quizId}`)}>
            Back to quiz
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Inline delete confirmation card. */
function DeleteConfirmCard({
  deleting, onCancel, onConfirm,
}: {
  deleting: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-sm text-destructive">Delete this question?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          This will permanently delete the question and all its answers.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1"
            onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" size="sm" className="flex-1"
            onClick={onConfirm} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function QuestionEditor({
  quizId, questionId, logicType = "basic",
}: {
  quizId: string; questionId: string; logicType?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/questions/${questionId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load question");
        return r.json() as Promise<{ question: QuestionData }>;
      })
      .then((data) => { if (!cancelled) setForm(toFormState(data.question)); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [questionId]);

  async function handleSave() {
    setError(null); setSaving(true);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type, title: form.title,
          subtitle: form.subtitle || null, description: form.description || null,
          image: form.image || null, required: form.required,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = (await res.json()) as { question: QuestionData };
      setForm(toFormState(data.question));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    setError(null); setDeleting(true);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push(`/quiz/${quizId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setDeleting(false); setShowDeleteConfirm(false);
    }
  }

  if (loading) return <EditorSkeleton />;
  if (error && form === BLANK_FORM) return <EditorError error={error} quizId={quizId} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Edit Question</h2>
        <Button variant="ghost" size="sm" disabled={saving || deleting}
          onClick={() => setShowDeleteConfirm(true)}
          className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      <QuestionFormFields form={form} saving={saving} onChange={setForm} />

      <div className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Answers section */}
      <AnswerEditor questionId={questionId} quizId={quizId} logicType={logicType} />

      {showDeleteConfirm && (
        <DeleteConfirmCard deleting={deleting}
          onCancel={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form fields (rendering only — delegates state mutations via onChange)
// ---------------------------------------------------------------------------

function QuestionFormFields({
  form, saving, onChange,
}: {
  form: FormState; saving: boolean;
  onChange: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="space-y-4">
      <Field label="Title" htmlFor="q-title">
        <Input id="q-title" value={form.title} disabled={saving}
          onChange={(e) => onChange((f) => ({ ...f, title: e.target.value }))} />
      </Field>
      <Field label="Subtitle" htmlFor="q-subtitle">
        <Input id="q-subtitle" value={form.subtitle} disabled={saving}
          onChange={(e) => onChange((f) => ({ ...f, subtitle: e.target.value }))}
          placeholder="Optional subtitle" />
      </Field>
      <Field label="Question Type" htmlFor="q-type">
        <Select id="q-type" value={form.type} disabled={saving}
          onChange={(e) => onChange((f) => ({ ...f, type: e.target.value }))}>
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </Field>
      {form.type === "imageText" && (
        <Field label="Image URL" htmlFor="q-image">
          <Input id="q-image" value={form.image} disabled={saving}
            onChange={(e) => onChange((f) => ({ ...f, image: e.target.value }))}
            placeholder="https://example.com/image.jpg" />
        </Field>
      )}
      <Field label="Description" htmlFor="q-desc">
        <textarea id="q-desc" rows={3} value={form.description} disabled={saving}
          onChange={(e) => onChange((f) => ({ ...f, description: e.target.value }))}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Optional description" />
      </Field>
      <div className="flex items-center justify-between">
        <Label htmlFor="q-required">Required</Label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input id="q-required" type="checkbox" className="sr-only peer"
            checked={form.required} disabled={saving}
            onChange={(e) => onChange((f) => ({ ...f, required: e.target.checked }))} />
          <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small field wrapper (eliminates repetitive div/Label boilerplate)
// ---------------------------------------------------------------------------

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
