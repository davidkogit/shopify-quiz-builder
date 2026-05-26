"use client";

import { useState } from "react";
import "../widget.css";

interface EmailCapturePageProps {
  onSubmit: (data: { email: string; name?: string; phone?: string }) => void;
  requireEmail: boolean;
  gdprEnabled?: boolean;
}

function isValidEmail(v: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

export function EmailCapturePage({ onSubmit, requireEmail, gdprEnabled }: EmailCapturePageProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requireEmail && !isValidEmail(email)) { setError("Please enter a valid email address"); return; }
    if (gdprEnabled && !consent) return;
    setError(null);
    onSubmit({ email, name: name || undefined, phone: phone || undefined });
  }

  return (
    <div className="qk-page qk-email-capture">
      <h3 className="qk-intro-title">Get Your Results</h3>
      <p className="qk-intro-subtitle">Enter your email to see your personalized recommendations.</p>
      <form onSubmit={handleSubmit}>
        <input className={`qk-input${error ? " qk-error" : ""}`}
          type="email" placeholder="Email address *" value={email}
          onChange={(e) => setEmail(e.target.value)} required={requireEmail} autoFocus />
        {error && <p className="qk-input-error">{error}</p>}
        <input className="qk-input" type="text" placeholder="Name (optional)"
          value={name} onChange={(e) => setName(e.target.value)} />
        <input className="qk-input" type="tel" placeholder="Phone (optional)"
          value={phone} onChange={(e) => setPhone(e.target.value)} />
        {gdprEnabled && (
          <label style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",marginBottom:12 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree to receive marketing emails</span>
          </label>
        )}
        <button type="submit" className="qk-btn-primary" disabled={requireEmail && !email.trim()}>
          Submit &amp; See Results
        </button>
        <p className="qk-email-note">We respect your privacy. No spam, ever.</p>
      </form>
    </div>
  );
}
