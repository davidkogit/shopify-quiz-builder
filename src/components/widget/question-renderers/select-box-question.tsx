"use client";

/**
 * SelectBoxQuestion — Dropdown select populated from question answers.
 * Passes the selected answer ID as a single-element answerIds array.
 */
type QA = { id: string; title: string; order: number };
type QD = { title: string; subtitle: string | null; required: boolean; settings: unknown; answers: QA[] };

interface Props {
  question: QD;
  selectedAnswerIds: string[];
  onChange: (answerIds: string[]) => void;
  disabled?: boolean;
}

export function SelectBoxQuestion({ question, selectedAnswerIds, onChange, disabled }: Props) {
  const value = selectedAnswerIds[0] ?? "";
  const unanswered = question.required && !value;

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
      <select
        className={`qk-select${unanswered ? " qk-error" : ""}`}
        value={value}
        onChange={(e) => onChange([e.target.value])}
        disabled={disabled}
      >
        <option value="" disabled>
          Select an option...
        </option>
        {[...question.answers]
          .sort((a, b) => a.order - b.order)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
      </select>
    </div>
  );
}
