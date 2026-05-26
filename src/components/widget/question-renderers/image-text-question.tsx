"use client";

/**
 * ImageTextQuestion — Multi-select grid of image+text answer cards.
 * 2-column grid on mobile, 3-column on wider screens.
 * Selected cards show a checkmark overlay.
 */
type QA = { id: string; title: string; image: string | null; order: number };
type QD = { title: string; subtitle: string | null; required: boolean; settings: unknown; answers: QA[] };

interface Props {
  question: QD;
  selectedAnswerIds: string[];
  onChange: (answerIds: string[]) => void;
  disabled?: boolean;
}

const checkmarkStyle: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  background: "var(--qk-primary)",
  color: "#fff",
  borderRadius: "50%",
  width: 22,
  height: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
};

export function ImageTextQuestion({ question, selectedAnswerIds, onChange, disabled }: Props) {
  const unanswered = question.required && selectedAnswerIds.length === 0;

  const handleClick = (answerId: string) => {
    if (disabled) return;
    onChange(
      selectedAnswerIds.includes(answerId)
        ? selectedAnswerIds.filter((id) => id !== answerId)
        : [...selectedAnswerIds, answerId],
    );
  };

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
      <div className="qk-answer-grid">
        {question.answers.map((a) => {
          const sel = selectedAnswerIds.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={`qk-answer-card${sel ? " qk-selected" : ""}`}
              onClick={() => handleClick(a.id)}
              disabled={disabled}
              style={sel ? { position: "relative" } : undefined}
            >
              {a.image && <img src={a.image} alt="" className="qk-answer-image" />}
              <span className="qk-answer-text">{a.title}</span>
              {sel && <span style={checkmarkStyle}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
