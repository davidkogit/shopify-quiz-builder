"use client";

/**
 * RangeSliderQuestion — Horizontal slider with min/max labels and current value display.
 * Passes the selected value as a single-element answerIds array.
 */
type QD = { title: string; subtitle: string | null; required: boolean; settings: unknown };

interface Props {
  question: QD;
  selectedAnswerIds: string[];
  onChange: (answerIds: string[]) => void;
  disabled?: boolean;
}

export function RangeSliderQuestion({ question, selectedAnswerIds, onChange, disabled }: Props) {
  const s = question.settings as Record<string, unknown>;
  const min = (s?.rangeMin as number) ?? 0;
  const max = (s?.rangeMax as number) ?? 100;
  const step = (s?.rangeStep as number) ?? 1;
  const value = selectedAnswerIds[0] ?? String(min);
  const unanswered = question.required && selectedAnswerIds.length === 0;

  const wrapperStyle: React.CSSProperties = disabled
    ? { opacity: 0.5, pointerEvents: "none" }
    : {};

  return (
    <div style={wrapperStyle}>
      <h3 className="qk-question-title">
        {question.title}
        {unanswered && <span style={{ color: "var(--qk-error)" }}> *</span>}
      </h3>
      {question.subtitle && <p className="qk-question-subtitle">{question.subtitle}</p>}
      <div className="qk-range-slider">
        <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {value}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange([e.target.value])}
          disabled={disabled}
        />
        <div className="qk-range-labels">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
