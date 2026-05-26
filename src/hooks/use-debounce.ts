"use client";

import { useState, useEffect } from "react";

/**
 * Debounce a value by `delay` ms — only updates after the value stops changing.
 * Uses cleanup to cancel pending timer when value changes before delay expires.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
