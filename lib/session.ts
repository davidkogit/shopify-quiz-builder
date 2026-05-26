/**
 * Encrypted Session Management for Shopify OAuth
 *
 * Stores Shopify session data (shop domain, access token, scopes) in an
 * HTTP-only, secure, SameSite cookie encrypted with AES-256-GCM.
 *
 * Encryption key is derived via SHA-256 from the SESSION_SECRET environment
 * variable so the raw secret never appears in the cookie payload.
 *
 * All core crypto functions are **pure** — they accept the secret as an
 * explicit dependency and produce deterministic output (modulo random IV).
 * Cookie I/O helpers accept an explicit cookie-store interface so they
 * remain testable without mocking global Next.js APIs.
 */

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the cookie that holds the encrypted session. */
const COOKIE_NAME = "shopify_session";

/** AES-256-GCM algorithm identifier. */
const ALGORITHM = "aes-256-gcm";

/** GCM initialisation vector length in bytes (recommended: 12). */
const IV_LENGTH = 12;

/** GCM authentication tag length in bytes (recommended: 16). */
const AUTH_TAG_LENGTH = 16;

/** Default session cookie max-age in seconds (30 days). */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Payload stored inside the encrypted session cookie.
 *
 * @property shopifyDomain - The `.myshopify.com` domain of the shop.
 * @property accessToken   - Shopify Admin API access token (offline or online).
 * @property scopes        - Space-separated OAuth scopes granted by the merchant.
 * @property expiresAt     - Unix-ms timestamp when the token expires (optional;
 *                           omitted for perpetual offline tokens).
 * @property isOnline      - Whether the token is an *online* access token.
 */
export interface Session {
  shopifyDomain: string;
  accessToken: string;
  scopes: string;
  expiresAt?: number;
  isOnline?: boolean;
}

/**
 * Minimal cookie-store contract.
 *
 * Next.js `ReadonlyRequestCookies` and `ResponseCookies` satisfy this
 * interface, but any object with the same shape works — useful for testing.
 */
export interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax" | "strict" | "none";
      path: string;
      maxAge: number;
    },
  ): void;
  delete(name: string): void;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Derive a 32-byte AES-256 key from a UTF-8 secret string using SHA-256.
 *
 * **Pure** — deterministic; same secret always produces the same key.
 */
function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Determine whether the app is running in a secure (HTTPS) context.
 *
 * Uses `NODE_ENV` as a heuristic: production builds are expected to run
 * behind HTTPS.
 */
function isSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

// ---------------------------------------------------------------------------
// Public API — encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a {@link Session} object into a URL-safe base-64 string suitable
 * for storage in a cookie.
 *
 * Uses AES-256-GCM with a random 12-byte IV. The output encodes:
 * `IV (12) ‖ auth-tag (16) ‖ ciphertext`.
 *
 * **Pure** modulo the random IV — repeatable with the same inputs (key, IV).
 *
 * @param session - The session payload to encrypt.
 * @param secret  - The `SESSION_SECRET` value used for key derivation.
 * @returns A URL-safe base-64 encoded ciphertext string.
 */
export async function encryptSession(
  session: Session,
  secret: string,
): Promise<string> {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(session);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64url");
}

/**
 * Decrypt a URL-safe base-64 string (previously produced by
 * {@link encryptSession}) back into a {@link Session} object.
 *
 * Returns `null` when:
 * - The ciphertext is malformed or has been tampered with.
 * - The session has expired (`expiresAt < Date.now()`).
 *
 * **Pure** — deterministic for a given ciphertext and secret.
 *
 * @param encrypted - The ciphertext produced by `encryptSession`.
 * @param secret    - The `SESSION_SECRET` value used for key derivation.
 * @returns The decrypted session or `null` on failure.
 */
export async function decryptSession(
  encrypted: string,
  secret: string,
): Promise<Session | null> {
  try {
    const key = deriveKey(secret);
    const combined = Buffer.from(encrypted, "base64url");

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    const session: Session = JSON.parse(decrypted.toString("utf8"));

    // Honour explicit expiry — expired sessions trigger re-auth.
    if (session.expiresAt != null && session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    // Any crypto or parse failure means the session is invalid.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API — cookie I/O (explicit dependency on CookieStore)
// ---------------------------------------------------------------------------

/**
 * Read the encrypted session from a cookie store and decrypt it.
 *
 * Accepts the cookie store as an **explicit dependency** so the function
 * remains pure relative to it — no hidden global `cookies()` call.
 *
 * @param cookieStore - Object implementing {@link CookieStore#get}.
 * @param secret      - The `SESSION_SECRET` value used for key derivation.
 * @returns The decrypted session or `null` if the cookie is absent or invalid.
 */
export async function getSessionFromCookie(
  cookieStore: Pick<CookieStore, "get">,
  secret: string,
): Promise<Session | null> {
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) {
    return null;
  }
  return decryptSession(cookie.value, secret);
}

/**
 * Encrypt a session and write it to the response cookie store.
 *
 * The cookie is set with **HTTP-only**, **SameSite=Lax**, and **Secure**
 * (in production) flags per Shopify's embedded-app security requirements.
 *
 * @param session     - The session to persist.
 * @param secret      - The `SESSION_SECRET` value used for key derivation.
 * @param cookieStore - Object implementing {@link CookieStore#set}.
 */
export async function setSessionCookie(
  session: Session,
  secret: string,
  cookieStore: Pick<CookieStore, "set">,
): Promise<void> {
  const encrypted = await encryptSession(session, secret);

  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Remove the session cookie (e.g. on logout or uninstall).
 *
 * @param cookieStore - Object implementing {@link CookieStore#delete}.
 */
export function clearSessionCookie(
  cookieStore: Pick<CookieStore, "delete">,
): void {
  cookieStore.delete(COOKIE_NAME);
}
