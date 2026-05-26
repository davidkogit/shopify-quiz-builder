"use client";

import "../widget.css";

interface NavigationProps {
  onBack?: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  stepLabel?: string;
}

export function Navigation({
  onBack, onNext, canGoBack, canGoNext, stepLabel,
}: NavigationProps) {
  const disableBack = !canGoBack || !onBack;

  return (
    <nav className="qk-nav">
      <button
        type="button"
        className="qk-btn-nav"
        onClick={onBack}
        disabled={disableBack}
        aria-label="Go back"
      >
        ← Back
      </button>
      {stepLabel && <span className="qk-nav-count">{stepLabel}</span>}
      <button
        type="button"
        className="qk-btn-nav qk-nav-next"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Go next"
      >
        Next →
      </button>
    </nav>
  );
}
