"use client";

/**
 * PublishEditor — Publish toggle + embed instructions for a quiz.
 *
 * Renders inside the quiz settings panel when tab=publish.
 * Shows a draft/published status toggle and, when published, four
 * embed methods with copy buttons.
 *
 * Sub-components are small pure functions (< 50 lines).
 */

import { useState, useCallback } from "react";
import {
  Circle,
  CheckCircle2,
  Copy,
  Check,
  Globe,
  ShoppingBag,
  Monitor,
  Code,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface PublishEditorProps {
  quizId: string;
  quizKey: string;
  initialStatus: string;
  abTestId: string | null;
  variantQuizKey: string | null;
}

interface EmbedMethodDef {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  language: string;
  code: (key: string) => string;
}

// ============================================================================
// Embed method definitions
// ============================================================================

const EMBED_METHODS: EmbedMethodDef[] = [
  {
    id: "standalone",
    title: "Standalone Page",
    icon: Globe,
    description:
      "Direct URL to your quiz landing page. Share this link anywhere or use it as a standalone page in your store navigation.",
    language: "url",
    code: (key: string) => `/quiz/${key}`,
  },
  {
    id: "theme-section",
    title: "Shopify Theme Section",
    icon: ShoppingBag,
    description:
      "For Shopify themes, include the widget as a theme section or app embed block. Bundle files are served as theme assets.",
    language: "liquid",
    code: (key: string) =>
      `{% comment %} sections/quiz-kit-widget.liquid {% endcomment %}
<link rel="stylesheet" href="{{ 'widget/bundle.css' | asset_url }}">
<script src="{{ 'widget/bundle.js' | asset_url }}" defer></script>

<div
  data-quiz-key="${key}"
  style="max-width: 720px; margin: 2rem auto; padding: 1rem;"
></div>

{% schema %}
{
  "name": "Quiz Kit Widget",
  "settings": [
    {
      "type": "text",
      "id": "quiz_key",
      "label": "Quiz Key",
      "default": "${key}"
    }
  ],
  "presets": [{ "name": "Quiz Kit Widget" }]
}
{% endschema %}`,
  },
  {
    id: "popup",
    title: "Popup Trigger",
    icon: Monitor,
    description:
      "Launch the quiz inside a full-screen modal overlay. Place a CTA button on any page to open it.",
    language: "html",
    code: (key: string) =>
      `<!-- CTA button — place anywhere on the page -->
<button
  type="button"
  onclick="document.getElementById('quiz-popup').style.display='flex'"
  style="
    padding: 0.75rem 2rem;
    background: #111;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
  "
>
  Take Our Quiz
</button>

<!-- Hidden modal overlay -->
<div
  id="quiz-popup"
  data-quiz-key="${key}"
  style="
    display: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #fff;
    overflow-y: auto;
    padding: 2rem 1rem;
  "
>
  <button
    type="button"
    onclick="document.getElementById('quiz-popup').style.display='none'"
    style="
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
    "
    aria-label="Close quiz"
  >
    &times;
  </button>
</div>

<!-- Widget bundle (include once per page) -->
<link rel="stylesheet" href="/widget/bundle.css">
<script src="/widget/bundle.js" defer></script>`,
  },
  {
    id: "snippet",
    title: "Copy-Paste Snippet",
    icon: Code,
    description:
      "A minimal, self-contained snippet you can paste into any CMS, landing page builder, or custom HTML block.",
    language: "html",
    code: (key: string) =>
      `<!-- QuizKit Widget — Copy and paste into any page -->
<link rel="stylesheet" href="/widget/bundle.css">
<div data-quiz-key="${key}"></div>
<script src="/widget/bundle.js" defer></script>`,
  },
];

// ============================================================================
// Copy button sub-component
// ============================================================================

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [code]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

// ============================================================================
// A/B test embed section
// ============================================================================

function AbTestEmbedSection({
  quizKey,
  variantKey,
}: {
  quizKey: string;
  variantKey: string;
}) {
  const snippet = `<!-- QuizKit A/B Split Test Embed -->
<!-- Randomly assigns visitors to Variant A or Variant B (50/50 split).
     The choice is persisted via localStorage so returning visitors
     always see the same variant. -->
<link rel="stylesheet" href="/widget/bundle.css">

<div id="quiz-kit-container" data-quiz-key="${quizKey}"></div>

<script>
(function() {
  var STORAGE_KEY = "quizkit_ab_variant";
  var KEY_A = "${quizKey}";
  var KEY_B = "${variantKey}";

  var chosen = localStorage.getItem(STORAGE_KEY);
  if (!chosen) {
    chosen = Math.random() < 0.5 ? KEY_A : KEY_B;
    localStorage.setItem(STORAGE_KEY, chosen);
  }

  var el = document.getElementById("quiz-kit-container");
  if (el) el.setAttribute("data-quiz-key", chosen);
})();
<\/script>

<script src="/widget/bundle.js" defer></script>`;

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-blue-700 dark:text-blue-400">
          A/B Split Test Embed
        </CardTitle>
        <CardDescription>
          This snippet randomly shows one of your two quiz variants (50/50
          split). The chosen variant is persisted via{" "}
          <code className="text-xs bg-muted px-1 rounded">localStorage</code>{" "}
          so returning visitors always see the same quiz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Variant keys display */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 rounded bg-muted/60">
            <span className="text-xs text-muted-foreground">Variant A</span>
            <p className="font-mono text-xs truncate">{quizKey}</p>
          </div>
          <div className="p-2 rounded bg-muted/60">
            <span className="text-xs text-muted-foreground">Variant B</span>
            <p className="font-mono text-xs truncate">{variantKey}</p>
          </div>
        </div>

        {/* Code block */}
        <div className="rounded-lg border bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              html
            </span>
            <CopyButton code={snippet} />
          </div>
          <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
            <code className="font-mono text-zinc-100">{snippet}</code>
          </pre>
        </div>

        <p className="text-xs text-muted-foreground">
          Each visitor is assigned via localStorage on first visit. Clear your
          browser storage to test both variants.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Status toggle section
// ============================================================================

interface StatusToggleProps {
  status: string;
  loading: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}

function StatusToggle({
  status,
  loading,
  onPublish,
  onUnpublish,
}: StatusToggleProps) {
  const isPublished = status === "published";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          Publish Status
          {isPublished ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isPublished
            ? "Your quiz is live and can be embedded on your storefront."
            : "Your quiz is in draft mode. Publish it to get embed instructions."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm",
              isPublished ? "text-emerald-600" : "text-red-500",
            )}
          >
            {isPublished ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            {isPublished ? "Published" : "Draft"}
          </span>
          <Button
            variant={isPublished ? "outline" : "default"}
            size="sm"
            onClick={isPublished ? onUnpublish : onPublish}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Standalone page URL section (special — shows as input, not code block)
// ============================================================================

function StandalonePageSection({ quizKey }: { quizKey: string }) {
  const url = `/quiz/${quizKey}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Standalone Page
        </CardTitle>
        <CardDescription>
          Direct URL to your quiz landing page. Share this link anywhere.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input value={url} readOnly className="font-mono text-sm" />
          <CopyButton code={url} />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Generic code embed section
// ============================================================================

function CodeEmbedSection({
  title,
  icon: Icon,
  description,
  language,
  code,
}: {
  title: string;
  icon: React.ElementType;
  description: string;
  language: string;
  code: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-lg border bg-zinc-950 overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              {language}
            </span>
            <CopyButton code={code} />
          </div>
          {/* Code content */}
          <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
            <code className="font-mono text-zinc-100">{code}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Draft prompt — shown when quiz is not published
// ============================================================================

function DraftPrompt() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Publish your quiz to get embed instructions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Once published, you&#39;ll see embed code snippets for
          Shopify, standalone pages, popups, and more.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Quiz key display section
// ============================================================================

function QuizKeySection({ quizKey }: { quizKey: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(quizKey);

  if (!editing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Quiz Key</CardTitle>
          <CardDescription>
            This unique key identifies your quiz in embed codes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={value} readOnly className="font-mono text-sm" />
            <CopyButton code={value} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Quiz Key</CardTitle>
        <CardDescription>
          This unique key identifies your quiz in embed codes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono text-sm"
          />
          <Button type="button" size="sm" onClick={() => setEditing(false)}>
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PublishEditor — main exported component
// ============================================================================

export function PublishEditor({
  quizId,
  quizKey,
  initialStatus,
  abTestId,
  variantQuizKey,
}: PublishEditorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const isPublished = status === "published";

  const handlePublish = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/publish`, {
        method: "POST",
      });
      if (res.ok) {
        setStatus("published");
      }
    } catch {
      // Silently ignore network errors
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  const handleUnpublish = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/unpublish`, {
        method: "POST",
      });
      if (res.ok) {
        setStatus("draft");
      }
    } catch {
      // Silently ignore network errors
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  return (
    <div className="space-y-5">
      {/* Status toggle */}
      <StatusToggle
        status={status}
        loading={loading}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
      />

      {/* Quiz key display */}
      <QuizKeySection quizKey={quizKey} />

      {/* A/B test embed — shown when quiz is part of a split test */}
      {abTestId && variantQuizKey && (
        <AbTestEmbedSection quizKey={quizKey} variantKey={variantQuizKey} />
      )}

      {/* Embed sections — only when published */}
      {isPublished ? (
        <>
          <StandalonePageSection quizKey={quizKey} />
          {EMBED_METHODS.filter((m) => m.id !== "standalone").map((method) => (
            <CodeEmbedSection
              key={method.id}
              title={method.title}
              icon={method.icon}
              description={method.description}
              language={method.language}
              code={method.code(quizKey)}
            />
          ))}
        </>
      ) : (
        <DraftPrompt />
      )}
    </div>
  );
}
