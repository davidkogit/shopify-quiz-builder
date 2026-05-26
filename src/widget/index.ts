/**
 * QuizKit Widget — standalone entry point for script-tag embedding.
 *
 * Builds to public/widget/bundle.js (IIFE) via esbuild.
 * React and ReactDOM are bundled inline for full self-containment.
 * CSS is loaded separately via <link rel="stylesheet" href="/widget/bundle.css">.
 */

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { QuizWidget } from "../components/widget/quiz-widget";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mount a QuizWidget into a DOM container.
 *
 * Reads `data-quiz-key` from the container element to determine which quiz
 * to load.  Returns an unmount function so the host page can clean up.
 *
 * @example
 *   const unmount = mountQuizWidget(document.getElementById('quiz-root'));
 *   // later: unmount();
 */
export function mountQuizWidget(container: HTMLElement): () => void {
  const quizKey = container.getAttribute("data-quiz-key");
  if (!quizKey) {
    throw new Error(
      "QuizKit: container element is missing the required data-quiz-key attribute",
    );
  }

  const root = createRoot(container);
  root.render(createElement(QuizWidget, { quizKey }));

  return () => {
    root.unmount();
  };
}

// ---------------------------------------------------------------------------
// Auto-mount — find every [data-quiz-key] element and mount a widget
// ---------------------------------------------------------------------------

function autoMountAll(): void {
  const containers = document.querySelectorAll<HTMLElement>("[data-quiz-key]");
  containers.forEach((container) => {
    try {
      mountQuizWidget(container);
    } catch (err) {
      // Don't let a single bad container break all others
      console.error("QuizKit auto-mount failed:", err);
    }
  });
}

// Run as early as the DOM allows
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMountAll);
  } else {
    // DOM already loaded — fire immediately
    autoMountAll();
  }
}
