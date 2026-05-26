"use client";

/**
 * TextBoxQuestion — Free-text input rendered as text input or textarea.
 * Passes typed text as a single-element answerIds array.
 */
type QD = { title: string; subtitle: string | null; required: boolean; settings: unknown };

interface Props {
  question: QD;
  selectedAnswerIds: string[];
  onChange: (answerIds: string[]) => void;
  disabled?: boolean;
}

export function TextBoxQuestion({ question, selectedAnswerIds, onChange, disabled }: Props) {
  const value = selectedAnswerIds[0] ?? "";
  const s = question.settings as Record<string, unknown>;
  const multiline = s?.multiline === true;
  const placeholder = (s?.placeholder as string) ?? "Type your answer...";
  const unanswered = question.required && !value.trim();

  const wrapperStyle: React.CSSProperties = disabled
    ? { opacity: 0.5, pointerEvents: "none" }
    : {};

  const sharedProps = {
    className: `qk-input${unanswered ? " qk-error" : ""}`,
    placeholder,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange([e.target.value]),
    disabled,
  };

  return (
    <div style={wrapperStyle}>
      <h3 className="qk-question-title">
        {question.title}
        {unanswered && <span style={{ color: "var(--qk-error)" }}> *</span>}
      </h3>
      {question.subtitle && <p className="qk-question-subtitle">{question.subtitle}</p>}
      {multiline ? (
        <textarea {...sharedProps} rows={4} />
      ) : (
        <input type="text" {...sharedProps} />
      )}
    </div>
  );
}
