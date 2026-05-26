/**
 * Email Utility Module
 *
 * Provides functions for sending quiz result emails via a configurable email
 * API (Resend, SendGrid, or any fetch-compatible provider).
 *
 * All core functions accept explicit dependencies so they remain testable
 * without mocking global env or fetch. The convenience wrapper
 * {@link sendQuizResultEmail} reads credentials from `process.env` and is
 * suitable for fire-and-forget use in API route handlers.
 *
 * Architecture:
 * - buildResultEmailHtml — pure HTML template string builder
 * - sendEmail            — pure fetch wrapper with explicit URL + key
 * - sendQuizResultEmail  — convenience that wires env → sendEmail
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload accepted by the email sending functions. */
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/** Data needed to build the result email HTML body. */
export interface ResultEmailData {
  quizName: string;
  resultTitle: string;
  resultDescription: string | null;
  products: { title: string; image?: string | null }[];
}

// ---------------------------------------------------------------------------
// buildResultEmailHtml — pure HTML template builder
// ---------------------------------------------------------------------------

/**
 * Build a responsive HTML email body for quiz results.
 *
 * Includes the quiz name, result title, result description, and a grid of
 * recommended products (name + optional image). Uses inline styles for
 * maximum email client compatibility.
 *
 * Pure — deterministic; same inputs always produce the same HTML string.
 */
export function buildResultEmailHtml(data: ResultEmailData): string {
  const { quizName, resultTitle, resultDescription, products } = data;

  const productCards = products
    .map(
      (p) => `
    <div style="text-align:center; padding:12px; background:#f8f8f8; border-radius:8px; margin-bottom:12px;">
      ${
        p.image
          ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" style="max-width:120px; height:auto; border-radius:4px; margin-bottom:8px;" />`
          : ""
      }
      <p style="margin:0; font-size:14px; font-weight:600; color:#333;">${esc(p.title)}</p>
    </div>`,
    )
    .join("\n");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(quizName)} — Your Results</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
    <tr>
      <td style="padding:32px 24px 16px; text-align:center;">
        <h1 style="margin:0; font-size:24px; color:#1a1a1a;">${esc(quizName)}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 16px; text-align:center;">
        <h2 style="margin:0; font-size:20px; color:#2563eb;">${esc(resultTitle)}</h2>
      </td>
    </tr>
    ${
      resultDescription
        ? `
    <tr>
      <td style="padding:0 24px 24px; text-align:center;">
        <p style="margin:0; font-size:16px; color:#555; line-height:1.5;">${esc(resultDescription)}</p>
      </td>
    </tr>`
        : ""
    }
    ${
      products.length > 0
        ? `
    <tr>
      <td style="padding:0 24px 24px;">
        <h3 style="margin:0 0 12px; font-size:18px; color:#1a1a1a;">Recommended For You</h3>
        ${productCards}
      </td>
    </tr>`
        : ""
    }
    <tr>
      <td style="padding:24px; text-align:center; border-top:1px solid #e5e5e5;">
        <p style="margin:0; font-size:12px; color:#999;">Sent by Quiz Kit — the Shopify quiz builder.</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ---------------------------------------------------------------------------
// sendEmail — pure fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Send an email by posting to a configurable email API endpoint.
 *
 * Uses the native `fetch` API — zero additional dependencies. The caller
 * provides the API URL and key explicitly, making this function pure
 * relative to its arguments (modulo network I/O) and fully testable.
 *
 * @param apiUrl - Full URL of the email API endpoint (e.g. Resend's send endpoint).
 * @param apiKey - Bearer token or API key for the email provider.
 * @param payload - The email to send: recipient, subject, and HTML body.
 * @throws If the HTTP request fails (non-2xx).
 */
export async function sendEmail(
  apiUrl: string,
  apiKey: string,
  payload: EmailPayload,
): Promise<void> {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "unknown error");
    throw new Error(
      `Email API returned ${res.status}: ${body.slice(0, 200)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// sendQuizResultEmail — convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Send a quiz result email using the configured email provider.
 *
 * Reads `EMAIL_API_URL` and `EMAIL_API_KEY` from the environment. If either
 * is missing, the function silently returns — email is an opt-in feature.
 *
 * Designed for **fire-and-forget** usage in API route handlers: the caller
 * should NOT await this function; instead, wrap it in a try/catch that
 * swallows errors so failed emails never affect the submission response.
 *
 * @param payload - The email to send: recipient, subject, and HTML body.
 *
 * @example
 * ```ts
 * // Fire-and-forget — don't block the submission response
 * sendQuizResultEmail({ to: "user@example.com", subject: "Results", html: "..." })
 *   .catch((err) => console.error("Email failed:", err));
 * ```
 */
export async function sendQuizResultEmail(payload: EmailPayload): Promise<void> {
  const apiUrl = process.env.EMAIL_API_URL;
  const apiKey = process.env.EMAIL_API_KEY;

  if (!apiUrl || !apiKey) {
    // Email is not configured — silently skip.
    return;
  }

  return sendEmail(apiUrl, apiKey, payload);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Escape HTML special characters to prevent injection in email templates. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
