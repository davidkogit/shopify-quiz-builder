/**
 * Admin Route Group Layout
 *
 * Provides the persistent admin chrome (sidebar + header) for all `/` routes.
 * Session validity is verified here (defence-in-depth — edge middleware has
 * already confirmed the cookie exists).
 *
 * Architecture:
 *   - Server Component: decrypts session, passes shopDomain to shell
 *   - Client Components: AdminShell, Sidebar, Header, AppBridgeProvider
 *
 * Marked force-dynamic: all admin pages require a live session and database,
 * so static generation at build time is not useful.
 */
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getSessionFromCookie, type Session } from "../../../lib/session";
import { env } from "../../../lib/env";
import { AdminShell } from "@/components/admin/admin-shell";
import { AppBridgeProvider } from "@/components/admin/app-bridge-provider";

// ---------------------------------------------------------------------------
// Server-side session resolution
// ---------------------------------------------------------------------------

/**
 * Decrypt and validate the session cookie.
 *
 * If the session is absent or invalid the middleware should have already
 * redirected — but we return `null` as a safety net so the UI can degrade
 * gracefully rather than crash.
 */
async function resolveSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return getSessionFromCookie(cookieStore, env.SESSION_SECRET);
}

// ---------------------------------------------------------------------------
// Admin layout
// ---------------------------------------------------------------------------

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();

  if (!session) {
    return null; // middleware should redirect, this is a fallback
  }

  return (
    <AppBridgeProvider>
      <AdminShell shopDomain={session?.shopifyDomain ?? "unknown.myshopify.com"}>
        {children}
      </AdminShell>
    </AppBridgeProvider>
  );
}
