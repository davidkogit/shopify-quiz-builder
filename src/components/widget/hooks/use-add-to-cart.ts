"use client";

import { useState, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddToCartResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Standalone helpers (no React state dependency)
// ---------------------------------------------------------------------------

/** POST to Shopify's Storefront Cart AJAX endpoint (relative URL). */
async function postCartAdd(
  variantId: string,
  quantity: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: variantId, quantity }] }),
  });
  if (!res.ok) {
    let msg = "Failed to add to cart";
    try {
      const body = await res.json();
      msg = body?.description || body?.message || body?.error || msg;
    } catch { /* body may not be JSON */ }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

/** Fire-and-forget analytics tracking. */
function trackAddToCart(
  quizKey: string,
  sessionId: string,
  variantId: string,
): void {
  fetch(`/api/public/quiz/${quizKey}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, event: "add_to_cart", variantId }),
  }).catch(() => { /* best-effort */ });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAddToCart(opts: { quizKey: string; sessionId: string }) {
  const { quizKey, sessionId } = opts;
  const [addingState, setAddingState] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [addedState, setAddedState] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [cartError, setCartError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addedTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const addToCart = useCallback(
    async (variantId: string, quantity = 1): Promise<AddToCartResult> => {
      setAddingState((prev) => new Map(prev).set(variantId, true));
      setCartError(null);
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      const { ok, error } = await postCartAdd(variantId, quantity);
      if (ok) {
        trackAddToCart(quizKey, sessionId, variantId);
        setAddedState((prev) => new Map(prev).set(variantId, true));
        const timer = setTimeout(() => {
          setAddedState((prev) => {
            const next = new Map(prev);
            next.delete(variantId);
            return next;
          });
          addedTimersRef.current.delete(variantId);
        }, 2000);
        addedTimersRef.current.set(variantId, timer);
      } else {
        setCartError(error ?? "Failed to add to cart");
        errorTimerRef.current = setTimeout(() => setCartError(null), 2000);
      }
      setAddingState((prev) => {
        const next = new Map(prev);
        next.delete(variantId);
        return next;
      });
      return ok ? { success: true } : { success: false, error };
    },
    [quizKey, sessionId],
  );

  return { addToCart, addingState, addedState, cartError };
}
