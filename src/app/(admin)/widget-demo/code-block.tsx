"use client";

/**
 * CodeBlock — A simple, accessible code display component.
 *
 * Renders syntax-highlighted code in a <pre><code> block with a
 * language label and a copy-to-clipboard button.
 */
import { useState, useCallback } from "react";

// ============================================================================
// Props
// ============================================================================

interface CodeBlockProps {
  code: string;
  language: string;
}

// ============================================================================
// Component
// ============================================================================

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently ignore
    }
  }, [code]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* ---- Header bar ---- */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-muted-foreground hover:text-foreground
                     transition-colors focus:ring-2 focus:ring-ring
                     focus:ring-offset-2 rounded px-2 py-0.5"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* ---- Code content ---- */}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed bg-muted/20">
        <code className={`language-${language} font-mono text-foreground/90`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
