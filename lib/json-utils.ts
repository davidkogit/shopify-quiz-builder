/**
 * Shared JSON Parsing Utilities
 *
 * Safe JSON parse helpers used across the codebase for parsing database
 * fields that store JSON strings (settings, tags, outcome data, etc.).
 */

/**
 * Safely parse a JSON string, returning the provided fallback on failure
 * or when the input is `null`/`undefined`.
 *
 * @param raw      - The JSON string to parse, or `null`.
 * @param fallback - Default value returned on parse failure or null input.
 */
export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
