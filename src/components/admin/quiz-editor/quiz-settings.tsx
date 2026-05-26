"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOGIC_TYPES = [
  { value: "basic", label: "Basic" },
  { value: "single", label: "Single" },
  { value: "points", label: "Points" },
  { value: "productWeight", label: "Product Weight" },
  { value: "resultWeight", label: "Result Weight" },
  { value: "combination", label: "Combination" },
] as const;

type LogicType = (typeof LOGIC_TYPES)[number]["value"];

/** Describes which sections are active for each logic type. */
interface LogicSections {
  productPicker: boolean;
  pointsField: boolean;
  weightFields: boolean;
  resultLinks: boolean;
  pathBuilder: boolean;
}

const LOGIC_SECTION_MAP: Record<LogicType, LogicSections> = {
  basic: {
    productPicker: false,
    pointsField: false,
    weightFields: false,
    resultLinks: false,
    pathBuilder: true,
  },
  single: {
    productPicker: true,
    pointsField: false,
    weightFields: false,
    resultLinks: false,
    pathBuilder: false,
  },
  points: {
    productPicker: false,
    pointsField: true,
    weightFields: false,
    resultLinks: false,
    pathBuilder: false,
  },
  productWeight: {
    productPicker: true,
    pointsField: false,
    weightFields: true,
    resultLinks: false,
    pathBuilder: false,
  },
  resultWeight: {
    productPicker: false,
    pointsField: false,
    weightFields: false,
    resultLinks: true,
    pathBuilder: false,
  },
  combination: {
    productPicker: true,
    pointsField: false,
    weightFields: false,
    resultLinks: false,
    pathBuilder: true,
  },
};

const SECTION_LABELS: { key: keyof LogicSections; label: string }[] = [
  { key: "productPicker", label: "Product Picker" },
  { key: "pointsField", label: "Points Field" },
  { key: "weightFields", label: "Product Weight Fields" },
  { key: "resultLinks", label: "Result Link Picker" },
  { key: "pathBuilder", label: "Path Builder (Result-level)" },
];

// ---------------------------------------------------------------------------
// Live Preview — shows active/inactive config sections
// ---------------------------------------------------------------------------

function SectionPreview({ sections }: { sections: LogicSections }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Active Config Sections
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {SECTION_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            {sections[key] ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            <span className={sections[key] ? "text-foreground" : "text-muted-foreground/50"}>
              {label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// QuizSettings — main exported component
// ---------------------------------------------------------------------------

interface QuizSettingsProps {
  quizId: string;
  initialLogicType: string;
  initialSettings?: Record<string, unknown>;
}

export function QuizSettings({
  quizId,
  initialLogicType,
  initialSettings = {},
}: QuizSettingsProps) {
  const [logicType, setLogicType] = useState(initialLogicType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [discountCode, setDiscountCode] = useState(
    (initialSettings.discountCode as string) ?? "",
  );
  const [discountLabel, setDiscountLabel] = useState(
    (initialSettings.discountLabel as string) ?? "",
  );

  const sections =
    LOGIC_SECTION_MAP[logicType as LogicType] ??
    LOGIC_SECTION_MAP.basic;

  const hasChanges =
    logicType !== initialLogicType ||
    discountCode !== ((initialSettings.discountCode as string) ?? "") ||
    discountLabel !== ((initialSettings.discountLabel as string) ?? "");

  async function handleSave() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const updatedSettings = {
        ...initialSettings,
        discountCode,
        discountLabel,
      };
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logicType,
          settings: JSON.stringify(updatedSettings),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string })?.error ?? "Failed to update settings",
        );
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Logic Type selector */}
      <div className="space-y-2">
        <Label htmlFor="quiz-logic-type">Recommendation Logic Type</Label>
        <p className="text-xs text-muted-foreground">
          Determines how answers are mapped to product recommendations.
          Changing this does not delete existing config — it only shows or hides
          the relevant fields throughout the editor.
        </p>
        <Select
          id="quiz-logic-type"
          value={logicType}
          onChange={(e) => {
            setLogicType(e.target.value);
            setSaved(false);
          }}
          disabled={saving}
        >
          {LOGIC_TYPES.map((lt) => (
            <option key={lt.value} value={lt.value}>
              {lt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Live preview of active sections */}
      <SectionPreview sections={sections} />

      {/* Discount Code Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Discount Code
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Show a discount code to customers who complete the quiz. Leave
            empty to hide.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discount-code">Discount Code</Label>
            <Input
              id="discount-code"
              placeholder="e.g. QUIZ10"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value);
                setSaved(false);
              }}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount-label">
              Display Text{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="discount-label"
              placeholder="e.g. Use code QUIZ10 for 10% off"
              value={discountLabel}
              onChange={(e) => {
                setDiscountLabel(e.target.value);
                setSaved(false);
              }}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="space-y-2">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-primary">Settings updated successfully.</p>
        )}
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
