"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

const OUTCOME_TYPES = [
  { value: "product", label: "Product" },
  { value: "collection", label: "Collection" },
  { value: "tags", label: "Tags" },
  { value: "text", label: "Text" },
  { value: "urlRedirect", label: "URL Redirect" },
] as const;

type OutcomeType = (typeof OUTCOME_TYPES)[number]["value"];

interface ResultData {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  order: number;
  outcomeType: string;
  outcomeData: string;
  pointsFrom: number | null;
  pointsTo: number | null;
}

interface FormState {
  title: string;
  description: string;
  image: string;
  order: number;
  outcomeType: OutcomeType;
  outcomeData: Record<string, unknown>;
  pointsFrom: string; // string for input binding, parsed to int|null on save
  pointsTo: string;
}

const BLANK_FORM: FormState = {
  title: "",
  description: "",
  image: "",
  order: 0,
  outcomeType: "product",
  outcomeData: {},
  pointsFrom: "",
  pointsTo: "",
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Parse the outcomeData JSON string, returning an empty object on failure. */
function parseOutcomeData(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Extract the string value for a given outcome data key. */
function outcomeField(data: Record<string, unknown>, key: string): string {
  const val = data[key];
  return typeof val === "string" ? val : "";
}

/** Build the FormState from server data, normalising nulls and parsing JSON. */
function toFormState(r: ResultData): FormState {
  const od = parseOutcomeData(r.outcomeData);
  return {
    title: r.title,
    description: r.description ?? "",
    image: r.image ?? "",
    order: r.order,
    outcomeType: r.outcomeType as OutcomeType,
    outcomeData: od,
    pointsFrom: r.pointsFrom != null ? String(r.pointsFrom) : "",
    pointsTo: r.pointsTo != null ? String(r.pointsTo) : "",
  };
}

/** Parse a string into an integer or null (empty / non-numeric → null). */
function parsePointsValue(val: string): number | null {
  if (val.trim() === "") return null;
  const n = Number(val);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Loading skeleton while fetching data. */
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

/** Error display when fetch fails entirely. */
function EditorError({ error, quizId }: { error: string; quizId: string }) {
  const router = useRouter();
  return (
    <div className="p-6">
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/quiz/${quizId}`)}
          >
            Back to quiz
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ResultEditor({
  quizId,
  resultId,
  logicType,
}: {
  quizId: string;
  resultId: string;
  /** The quiz logicType — used to show/hide points range fields. */
  logicType: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const showPoints = logicType === "points";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/results/${resultId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load result");
        return r.json() as Promise<{ result: ResultData }>;
      })
      .then((data) => {
        if (!cancelled) setForm(toFormState(data.result));
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resultId]);

  /** Build the PUT payload from current form state. */
  function buildPayload(): Record<string, unknown> {
    const pointsFrom = parsePointsValue(form.pointsFrom);
    const pointsTo = parsePointsValue(form.pointsTo);

    // Validate points range
    const validationErrors: Record<string, string> = {};
    if (
      pointsFrom !== null &&
      pointsTo !== null &&
      pointsFrom > pointsTo
    ) {
      validationErrors.points = "Points From must be ≤ Points To";
    }

    setSaveErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return {};

    return {
      title: form.title,
      description: form.description || null,
      image: form.image || null,
      order: form.order,
      outcomeType: form.outcomeType,
      outcomeData: JSON.stringify(form.outcomeData),
      pointsFrom: showPoints ? pointsFrom : null,
      pointsTo: showPoints ? pointsTo : null,
    };
  }

  async function handleSave() {
    setError(null);
    const payload = buildPayload();
    if (Object.keys(payload).length === 0 && !saveErrors.points) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/results/${resultId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errBody?.error ?? "Save failed");
      }
      const data = (await res.json()) as { result: ResultData };
      setForm(toFormState(data.result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  /** Update a single outcomeData field while keeping existing keys. */
  function updateOutcomeField(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      outcomeData: { ...prev.outcomeData, [key]: value },
    }));
  }

  /** Switch outcomeType — reset outcomeData to empty on change. */
  function handleOutcomeTypeChange(nextType: OutcomeType) {
    setForm((prev) => ({ ...prev, outcomeType: nextType, outcomeData: {} }));
  }

  if (loading) return <EditorSkeleton />;
  if (error && form === BLANK_FORM)
    return <EditorError error={error} quizId={quizId} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Edit Result</h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => router.push(`/quiz/${quizId}?tab=results`)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <Field label="Title" htmlFor="r-title">
          <Input
            id="r-title"
            value={form.title}
            disabled={saving}
            onChange={(e) =>
              setForm((f) => ({ ...f, title: e.target.value }))
            }
          />
        </Field>

        {/* Description */}
        <Field label="Description" htmlFor="r-desc">
          <textarea
            id="r-desc"
            rows={3}
            value={form.description}
            disabled={saving}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Optional description"
          />
        </Field>

        {/* Image URL */}
        <Field label="Image URL" htmlFor="r-image">
          <Input
            id="r-image"
            value={form.image}
            disabled={saving}
            onChange={(e) =>
              setForm((f) => ({ ...f, image: e.target.value }))
            }
            placeholder="https://example.com/image.jpg"
          />
        </Field>

        {/* Order */}
        <Field label="Order" htmlFor="r-order">
          <Input
            id="r-order"
            type="number"
            value={form.order}
            disabled={saving}
            onChange={(e) =>
              setForm((f) => ({ ...f, order: Number(e.target.value) }))
            }
            className="w-24"
          />
        </Field>

        {/* Outcome Type */}
        <Field label="Outcome Type" htmlFor="r-outcome">
          <Select
            id="r-outcome"
            value={form.outcomeType}
            disabled={saving}
            onChange={(e) =>
              handleOutcomeTypeChange(e.target.value as OutcomeType)
            }
          >
            {OUTCOME_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        {/* Dynamic Outcome Data fields */}
        <OutcomeDataFields
          type={form.outcomeType}
          data={form.outcomeData}
          disabled={saving}
          onChange={updateOutcomeField}
        />

        {/* Points range — only for Points logic */}
        {showPoints && (
          <PointsRangeFields
            pointsFrom={form.pointsFrom}
            pointsTo={form.pointsTo}
            disabled={saving}
            error={saveErrors.points}
            onChangeFrom={(v) => setForm((f) => ({ ...f, pointsFrom: v }))}
            onChangeTo={(v) => setForm((f) => ({ ...f, pointsTo: v }))}
          />
        )}
      </div>

      {/* Save */}
      <div className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outcome Data Fields — dynamic based on outcomeType
// ---------------------------------------------------------------------------

function OutcomeDataFields({
  type,
  data,
  disabled,
  onChange,
}: {
  type: OutcomeType;
  data: Record<string, unknown>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  switch (type) {
    case "product":
      return (
        <Field label="Product ID" htmlFor="od-product">
          <Input
            id="od-product"
            value={outcomeField(data, "productId")}
            disabled={disabled}
            onChange={(e) => onChange("productId", e.target.value)}
            placeholder="gid://shopify/Product/123"
          />
        </Field>
      );
    case "collection":
      return (
        <Field label="Collection Handle" htmlFor="od-collection">
          <Input
            id="od-collection"
            value={outcomeField(data, "handle")}
            disabled={disabled}
            onChange={(e) => onChange("handle", e.target.value)}
            placeholder="summer-sale"
          />
        </Field>
      );
    case "tags":
      return (
        <Field label="Tags (comma separated)" htmlFor="od-tags">
          <Input
            id="od-tags"
            value={outcomeField(data, "tags")}
            disabled={disabled}
            onChange={(e) => onChange("tags", e.target.value)}
            placeholder="summer, sale, new-arrival"
          />
        </Field>
      );
    case "text":
      return (
        <Field label="Custom Text" htmlFor="od-text">
          <textarea
            id="od-text"
            rows={4}
            value={outcomeField(data, "text")}
            disabled={disabled}
            onChange={(e) => onChange("text", e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Your custom result text..."
          />
        </Field>
      );
    case "urlRedirect":
      return (
        <Field label="Redirect URL" htmlFor="od-url">
          <Input
            id="od-url"
            value={outcomeField(data, "url")}
            disabled={disabled}
            onChange={(e) => onChange("url", e.target.value)}
            placeholder="https://example.com/thank-you"
          />
        </Field>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Points range — only visible for Points logic
// ---------------------------------------------------------------------------

function PointsRangeFields({
  pointsFrom,
  pointsTo,
  disabled,
  error,
  onChangeFrom,
  onChangeTo,
}: {
  pointsFrom: string;
  pointsTo: string;
  disabled: boolean;
  error?: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-4 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Points Range
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Points From" htmlFor="r-points-from">
          <Input
            id="r-points-from"
            type="number"
            value={pointsFrom}
            disabled={disabled}
            onChange={(e) => onChangeFrom(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Points To" htmlFor="r-points-to">
          <Input
            id="r-points-to"
            type="number"
            value={pointsTo}
            disabled={disabled}
            onChange={(e) => onChangeTo(e.target.value)}
            placeholder="100"
          />
        </Field>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Leave empty to leave that end of the range open.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small field wrapper
// ---------------------------------------------------------------------------

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
