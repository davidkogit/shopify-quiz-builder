"use client";

/**
 * RadioQuestion — Single/multi-select question with radio-button answer cards.
 * Supports allowMultiple via question.settings for checkbox-style multi-select.
 */
type QA = { id: string; title: string; image: string | null; order: number };
type QD = { title: string; subtitle: string | null; required: boolean; settings: unknown; answers: QA[] };

interface Props {
  question: QD;
  selectedAnswerIds: string[];
  onChange: (answerIds: string[]) => void;
  disabled?: boolean;
}

export function RadioQuestion({ question, selectedAnswerIds, onChange, disabled }: Props) {
  const allowMultiple = (question.settings as Record<string, unknown>)?.allowMultiple === true;
  const unanswered = question.required && selectedAnswerIds.length === 0;

  const handleClick = (answerId: string) => {
    if (disabled) return;
    if (allowMultiple) {
      onChange(
        selectedAnswerIds.includes(answerId)
          ? selectedAnswerIds.filter((id) => id !== answerId)
          : [...selectedAnswerIds, answerId],
      );
    } else {
      onChange([answerId]);
    }
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
      <div className="qk-answer-stack">
        {question.answers.map((a) => {
          const sel = selectedAnswerIds.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={`qk-answer-card${sel ? " qk-selected" : ""}`}
              onClick={() => handleClick(a.id)}
              disabled={disabled}
            >
              <span className="qk-answer-radio" />
              {a.image && <img src={a.image} alt="" className="qk-answer-image" />}
              <span className="qk-answer-text">{a.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
