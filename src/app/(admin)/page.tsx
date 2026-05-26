/**
 * Admin Dashboard — Home Page
 *
 * Server component that resolves the Shopify session, queries real stats
 * from the database, and renders the dashboard shell.  Interactivity
 * (create dialog, quiz list fetching) is delegated to client-component
 * islands.
 */
import { cookies } from "next/headers";
import { getSessionFromCookie } from "../../../lib/session";
import { getStore } from "../../../lib/store";
import { env } from "../../../lib/env";
import { prisma } from "../../../lib/prisma";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { DashboardQuizzesSection } from "@/components/admin/dashboard-quizzes-section";

// ---------------------------------------------------------------------------
// Server-side data fetching
// ---------------------------------------------------------------------------

async function resolveStoreId(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore, env.SESSION_SECRET);
  if (!session) return null;
  const store = await getStore(prisma, session.shopifyDomain);
  return store?.id ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard page (server component)
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const storeId = await resolveStoreId();

  const [quizCount, submissionCount] = storeId
    ? await Promise.all([
        prisma.quiz.count({ where: { storeId } }),
        prisma.submission.count({ where: { storeId } }),
      ])
    : [0, 0];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>

      <DashboardStats
        quizCount={quizCount}
        submissionCount={submissionCount}
      />

      {/* Quiz list + create button (client island) */}
      <DashboardQuizzesSection />
    </div>
  );
}
