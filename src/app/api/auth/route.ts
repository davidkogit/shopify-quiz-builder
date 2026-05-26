/**
 * GET /api/auth — Initiate Shopify OAuth
 *
 * With a `?shop=` parameter: redirects the merchant to the Shopify OAuth
 * authorization page so they can grant the scopes required by the app.
 *
 * Without a `?shop=` parameter: shows a friendly install page with a form
 * to enter the store domain.
 *
 * CSRF protection: the nonce is embedded in the `state` parameter as
 * `nonce.hmac` (signed with the API secret). This avoids the need for a
 * cookie, which can be stripped by some hosting environments on redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "../../../../lib/env";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function sanitiseShop(raw: string): string | null {
  const clean = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(clean)) return null;
  return clean;
}

function hmacSign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function buildAuthUrl(
  shop: string,
  nonce: string,
  statePayload: string,
  apiKey: string,
  scopes: string,
  redirectUri: string,
): string {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", statePayload);
  return url.toString();
}

/** Friendly HTML install page shown when no ?shop= param is given. */
function installPageHtml(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quiz Builder — Install</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px; max-width: 460px; width: 100%; margin: 20px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #666; margin-bottom: 24px; font-size: 15px; line-height: 1.5; }
    label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    .row { display: flex; gap: 8px; }
    input { flex: 1; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; outline: none; }
    input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    button { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    button:hover { background: #2563eb; }
    .hint { margin-top: 8px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📦 Quiz Builder</h1>
    <p>Install this quiz app on your Shopify store to create product recommendation quizzes for your customers.</p>
    <form onsubmit="install(event)">
      <label for="shop">Enter your Shopify store domain</label>
      <div class="row">
        <input id="shop" type="text" placeholder="your-store.myshopify.com" autofocus required>
        <button type="submit">Install</button>
      </div>
      <p class="hint">Example: my-cool-store.myshopify.com</p>
    </form>
  </div>
  <script>
    function install(e) {
      e.preventDefault();
      var shop = document.getElementById("shop").value.trim();
      if (shop) location.href = "?shop=" + encodeURIComponent(shop);
    }
    var params = new URLSearchParams(location.search);
    if (params.get("shop")) location.reload();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const shopParam = req.nextUrl.searchParams.get("shop");

  if (!shopParam) {
    return installPageHtml();
  }

  const shop = sanitiseShop(shopParam);
  if (!shop) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px"><h2>Invalid store domain</h2><p>"${shopParam}" doesn't look like a Shopify store domain. It should end with <code>.myshopify.com</code>.</p><p><a href="/api/auth">← Try again</a></p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  // Sign the nonce so we can verify it on callback without a cookie
  const statePayload = `${nonce}.${hmacSign(nonce, env.SHOPIFY_API_SECRET)}`;

  const redirectUri = `${env.HOST}/api/auth/callback`;
  const authUrl = buildAuthUrl(shop, nonce, statePayload, env.SHOPIFY_API_KEY, env.SHOPIFY_SCOPES, redirectUri);

  return NextResponse.redirect(authUrl);
}

/**
 * Verify a state payload of the form `nonce.hmac`.
 * Returns the nonce if valid, or null.
 */
export function verifyStatePayload(state: string, secret: string): string | null {
  const dot = state.lastIndexOf(".");
  if (dot === -1) return null;
  const nonce = state.slice(0, dot);
  const receivedHmac = state.slice(dot + 1);
  const expectedHmac = hmacSign(nonce, secret);
  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(receivedHmac, "hex");
  const b = Buffer.from(expectedHmac, "hex");
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? nonce : null;
}
