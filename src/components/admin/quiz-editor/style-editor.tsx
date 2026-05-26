"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_FAMILIES = [
  { value: "system-ui", label: "System UI" },
  { value: "Georgia", label: "Georgia" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
] as const;

const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "square", label: "Square" },
] as const;

interface StyleValues {
  fontFamily: string;
  primaryColor: string;
  buttonStyle: string;
  showProgressBar: boolean;
  introImageUrl: string;
  introSubtitle: string;
}

const DEFAULT_STYLES: StyleValues = {
  fontFamily: "system-ui",
  primaryColor: "#3B82F6",
  buttonStyle: "rounded",
  showProgressBar: true,
  introImageUrl: "",
  introSubtitle: "",
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Safe JSON parse with typed defaults.
 * Returns a fully-populated StyleValues object, merging with defaults
 * for any missing or unparseable fields.
 */
function parseStyles(raw: string): StyleValues {
  try {
    const parsed = JSON.parse(raw);
    return {
      fontFamily: parsed.fontFamily ?? DEFAULT_STYLES.fontFamily,
      primaryColor: parsed.primaryColor ?? DEFAULT_STYLES.primaryColor,
      buttonStyle: parsed.buttonStyle ?? DEFAULT_STYLES.buttonStyle,
      showProgressBar:
        typeof parsed.showProgressBar === "boolean"
          ? parsed.showProgressBar
          : DEFAULT_STYLES.showProgressBar,
      introImageUrl: parsed.introImageUrl ?? DEFAULT_STYLES.introImageUrl,
      introSubtitle: parsed.introSubtitle ?? DEFAULT_STYLES.introSubtitle,
    };
  } catch {
    return { ...DEFAULT_STYLES };
  }
}

/** Validate hex color string (3 or 6 hex digits after #). */
function isValidHex(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

// ---------------------------------------------------------------------------
// ColorPreview — pure presentation component
// ---------------------------------------------------------------------------

function ColorPreview({ color }: { color: string }) {
  const valid = isValidHex(color);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div
        className="h-8 w-8 rounded border border-input"
        style={{ backgroundColor: valid ? color : "transparent" }}
        aria-label={valid ? `Color preview: ${color}` : "Invalid hex color"}
      />
      <span className="text-xs text-muted-foreground font-mono">{color}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StyleEditor — main exported component
// ---------------------------------------------------------------------------

interface StyleEditorProps {
  quizId: string;
  initialStyles: string;
}

export function StyleEditor({ quizId, initialStyles }: StyleEditorProps) {
  const parsed = parseStyles(initialStyles);

  // Individual state fields for live preview
  const [fontFamily, setFontFamily] = useState(parsed.fontFamily);
  const [primaryColor, setPrimaryColor] = useState(parsed.primaryColor);
  const [buttonStyle, setButtonStyle] = useState(parsed.buttonStyle);
  const [showProgressBar, setShowProgressBar] = useState(
    parsed.showProgressBar,
  );
  const [introImageUrl, setIntroImageUrl] = useState(parsed.introImageUrl);
  const [introSubtitle, setIntroSubtitle] = useState(parsed.introSubtitle);

  // Save state machine
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const styles: StyleValues = {
        fontFamily,
        primaryColor,
        buttonStyle,
        showProgressBar,
        introImageUrl,
        introSubtitle,
      };
      const res = await fetch(`/api/admin/quizzes/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: JSON.stringify(styles) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string })?.error ?? "Failed to update styles",
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
      {/* Font Family */}
      <div className="space-y-2">
        <Label htmlFor="style-font-family">Font Family</Label>
        <Select
          id="style-font-family"
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value);
            setSaved(false);
          }}
          disabled={saving}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Primary Color with live preview swatch */}
      <div className="space-y-2">
        <Label htmlFor="style-primary-color">Primary Color</Label>
        <div className="flex items-center gap-3">
          <Input
            id="style-primary-color"
            type="text"
            value={primaryColor}
            placeholder="#3B82F6"
            onChange={(e) => {
              setPrimaryColor(e.target.value);
              setSaved(false);
            }}
            disabled={saving}
            className="font-mono"
          />
          <ColorPreview color={primaryColor} />
        </div>
      </div>

      {/* Button Style */}
      <div className="space-y-2">
        <Label htmlFor="style-button-style">Button Style</Label>
        <Select
          id="style-button-style"
          value={buttonStyle}
          onChange={(e) => {
            setButtonStyle(e.target.value);
            setSaved(false);
          }}
          disabled={saving}
        >
          {BUTTON_STYLES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Progress Bar Toggle (checkbox) */}
      <div className="space-y-2">
        <Label>Progress Bar Visibility</Label>
        <div className="flex items-center gap-2">
          <input
            id="style-progress-bar"
            type="checkbox"
            checked={showProgressBar}
            onChange={(e) => {
              setShowProgressBar(e.target.checked);
              setSaved(false);
            }}
            disabled={saving}
            className="h-4 w-4 rounded border-primary text-primary focus:ring-primary accent-primary cursor-pointer"
          />
          <Label
            htmlFor="style-progress-bar"
            className="font-normal text-sm cursor-pointer"
          >
            Show progress bar in quiz
          </Label>
        </div>
      </div>

      {/* Intro Image URL */}
      <div className="space-y-2">
        <Label htmlFor="style-intro-image">Intro Image URL</Label>
        <Input
          id="style-intro-image"
          type="text"
          value={introImageUrl}
          placeholder="https://example.com/image.jpg"
          onChange={(e) => {
            setIntroImageUrl(e.target.value);
            setSaved(false);
          }}
          disabled={saving}
        />
      </div>

      {/* Intro Subtitle */}
      <div className="space-y-2">
        <Label htmlFor="style-intro-subtitle">Intro Subtitle</Label>
        <Input
          id="style-intro-subtitle"
          type="text"
          value={introSubtitle}
          placeholder="Find the perfect product for you..."
          onChange={(e) => {
            setIntroSubtitle(e.target.value);
            setSaved(false);
          }}
          disabled={saving}
        />
      </div>

      {/* Save button with loading spinner and feedback */}
      <div className="space-y-2">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-primary">Styles updated successfully.</p>
        )}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
