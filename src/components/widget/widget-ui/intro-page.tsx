"use client";

import "../widget.css";

interface IntroPageProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  onStart: () => void;
}

export function IntroPage({ title, subtitle, imageUrl, onStart }: IntroPageProps) {
  return (
    <div className="qk-page qk-intro">
      {imageUrl && <img src={imageUrl} alt="" className="qk-intro-image" />}
      <h2 className="qk-intro-title">{title}</h2>
      {subtitle && <p className="qk-intro-subtitle">{subtitle}</p>}
      <button type="button" className="qk-btn-primary" onClick={onStart}>
        Start Quiz
      </button>
    </div>
  );
}
