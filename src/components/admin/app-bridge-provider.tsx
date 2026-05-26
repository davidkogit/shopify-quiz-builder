"use client";

import { useEffect } from "react";

/**
 * Client-side Shopify App Bridge initialisation.
 *
 * Loads App Bridge features when the app is rendered inside the Shopify
 * Admin iframe.  The `shopDomain` and `apiKey` are obtained from the DOM
 * (query-string parameters injected by Shopify) rather than from the
 * server-side session so this component stays purely client-side.
 *
 * Pure component — renders children unconditionally; initialisation is a
 * side-effect gated behind the presence of the global `shopify` object.
 */
export function AppBridgeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // App Bridge is only available inside the Shopify Admin iframe.
    if (typeof window === "undefined" || !("shopify" in window)) {
      return;
    }

    // App Bridge global is injected by the CDN script in <head>.
    const shopify = (window as Record<string, unknown>).shopify as
      | { loadFeatures?: (features: unknown[]) => void }
      | undefined;

    if (!shopify?.loadFeatures) {
      return;
    }

    shopify.loadFeatures([
      {
        name: "app-bridge",
        version: "latest",
      },
    ]);
  }, []);

  return <>{children}</>;
}
