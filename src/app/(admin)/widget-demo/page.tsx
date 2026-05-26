"use client";

/**
 * Widget Embed Demo Page
 *
 * Demonstrates how to embed the QuizKit widget on a storefront using
 * multiple integration patterns.  Includes a live preview powered by
 * the QuizWidget React component so merchants can test with their own
 * quiz key before deploying.
 *
 * Embedded inside the admin route group so the page inherits the
 * sidebar + header chrome from the (admin)/layout.tsx server component.
 */
import { useState, useCallback, type FormEvent } from "react";
import { QuizWidget } from "@/components/widget/quiz-widget";
import { CodeBlock } from "./code-block";

// ============================================================================
// Embed method definitions
// ============================================================================

interface EmbedMethod {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
}

const EMBED_METHODS: EmbedMethod[] = [
  {
    id: "standalone",
    title: "Standalone Script Embed",
    description:
      "Add the widget CSS and JS bundles to any HTML page, then place a container div with a data-quiz-key attribute. The widget auto-mounts on page load.",
    language: "html",
    code: `<!-- 1. Load widget styles in <head> -->
<link rel="stylesheet" href="/widget/bundle.css">

<!-- 2. Place the widget container anywhere in <body> -->
<div data-quiz-key="YOUR_QUIZ_KEY"></div>

<!-- 3. Load widget script at the end of <body> -->
<script src="/widget/bundle.js" defer></script>`,
  },
  {
    id: "theme-section",
    title: "Shopify Theme Section",
    description:
      "For Shopify themes, include the widget as a theme section or app embed block. The bundle files are served as theme assets and the quiz key is passed via section settings.",
    language: "liquid",
    code: `{% comment %} sections/quiz-kit-widget.liquid {% endcomment %}
<link rel="stylesheet" href="{{ 'widget/bundle.css' | asset_url }}">
<script src="{{ 'widget/bundle.js' | asset_url }}" defer></script>

<div
  data-quiz-key="{{ section.settings.quiz_key }}"
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
      "default": "DEMO_KEY"
    }
  ],
  "presets": [{ "name": "Quiz Kit Widget" }]
}
{% endschema %}`,
  },
  {
    id: "popup",
    title: "Popup / Modal Trigger",
    description:
      "Launch the quiz inside a full-screen modal. The container is hidden by default and revealed when the user clicks a CTA button.",
    language: "html",
    code: `<!-- CTA button placed anywhere on the page -->
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
  data-quiz-key="YOUR_QUIZ_KEY"
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
  <!-- Close button -->
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
    title: "Copy-Paste HTML Snippet",
    description:
      "A minimal, self-contained snippet you can paste into any CMS, landing page builder, or custom HTML block. Just update the quiz key.",
    language: "html",
    code: `<!-- QuizKit Widget — Copy and paste into any page -->
<link rel="stylesheet" href="/widget/bundle.css">
<div data-quiz-key="YOUR_QUIZ_KEY"></div>
<script src="/widget/bundle.js" defer></script>`,
  },
];

// ============================================================================
// Page header
// ============================================================================

function PageHeader() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">Widget Embed Demo</h1>
      <p className="text-muted-foreground max-w-2xl">
        Preview and test your quiz widget before embedding it on your storefront.
        Enter a quiz key below to see a live preview, then copy the embed code
        that matches your integration.
      </p>
    </div>
  );
}

// ============================================================================
// Live preview section
// ============================================================================

interface LivePreviewProps {
  inputKey: string;
  onInputChange: (value: string) => void;
  onLoad: () => void;
  quizKey: string | null;
}

function LivePreviewSection({
  inputKey,
  onInputChange,
  onLoad,
  quizKey,
}: LivePreviewProps) {
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      onLoad();
    },
    [onLoad],
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Live Preview</h2>

      {/* ---- Quiz key input ---- */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="quiz-key-input" className="sr-only">
          Quiz Key
        </label>
        <input
          id="quiz-key-input"
          type="text"
          value={inputKey}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Enter a quiz key (e.g. DEMO_KEY)"
          className="flex-1 px-4 py-2 border border-input rounded-lg text-sm
                     focus:ring-2 focus:ring-ring focus:border-transparent
                     transition-all bg-background"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg
                     text-sm font-medium hover:opacity-90 transition-opacity
                     focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Load Quiz
        </button>
      </form>

      {/* ---- Widget render area ---- */}
      <PreviewFrame>
        {quizKey ? (
          <div className="w-full max-w-lg">
            <QuizWidget quizKey={quizKey} />
          </div>
        ) : (
          <FallbackMessage />
        )}
      </PreviewFrame>

      {!quizKey && (
        <p className="text-xs text-muted-foreground">
          Enter a quiz key and click {"\u201C"}Load Quiz{"\u201D"} to see a live
          preview.  The widget will render inside the frame above.
        </p>
      )}
    </section>
  );
}

// ============================================================================
// Mock browser window frame
// ============================================================================

function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Title bar with traffic lights */}
      <div className="px-4 py-2 border-b bg-muted/40 flex items-center gap-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="block w-3 h-3 rounded-full bg-red-400" />
          <span className="block w-3 h-3 rounded-full bg-amber-400" />
          <span className="block w-3 h-3 rounded-full bg-emerald-400" />
        </span>
        <span className="text-xs text-muted-foreground ml-2 font-mono">
          quiz preview
        </span>
      </div>

      {/* Content area */}
      <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[200px] bg-muted/20">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Fallback when no quiz key is loaded
// ============================================================================

function FallbackMessage() {
  return (
    <div className="text-center space-y-3 py-8">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <svg
          className="w-6 h-6 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">
        No quiz loaded yet.
        <br />
        Enter a key above to preview your widget.
      </p>
    </div>
  );
}

// ============================================================================
// Embed code examples section
// ============================================================================

function EmbedExamplesSection() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Embed Methods</h2>
      <p className="text-sm text-muted-foreground">
        Choose the integration pattern that fits your storefront.  Each method
        loads the same widget — the difference is how it appears on the page.
      </p>

      {/* ---- Tab bar ---- */}
      <nav
        className="flex flex-wrap gap-1 border-b"
        role="tablist"
        aria-label="Embed methods"
      >
        {EMBED_METHODS.map((method, idx) => (
          <button
            key={method.id}
            type="button"
            role="tab"
            aria-selected={idx === activeTab}
            onClick={() => setActiveTab(idx)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors
              focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-t
              ${
                idx === activeTab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
          >
            {method.title}
          </button>
        ))}
      </nav>

      {/* ---- Active tab panel ---- */}
      <div role="tabpanel" className="space-y-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          {EMBED_METHODS[activeTab].description}
        </p>
        <CodeBlock
          code={EMBED_METHODS[activeTab].code}
          language={EMBED_METHODS[activeTab].language}
        />
      </div>
    </section>
  );
}

// ============================================================================
// Page export
// ============================================================================

export default function WidgetDemoPage() {
  const [inputKey, setInputKey] = useState("DEMO_KEY");
  const [quizKey, setQuizKey] = useState<string | null>(null);

  const handleLoad = useCallback(() => {
    const trimmed = inputKey.trim();
    if (trimmed) setQuizKey(trimmed);
  }, [inputKey]);

  return (
    <div className="space-y-10 max-w-4xl">
      <PageHeader />
      <LivePreviewSection
        inputKey={inputKey}
        onInputChange={setInputKey}
        onLoad={handleLoad}
        quizKey={quizKey}
      />
      <EmbedExamplesSection />
    </div>
  );
}
