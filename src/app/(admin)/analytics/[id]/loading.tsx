/**
 * Per-Quiz Analytics Loading Skeleton
 *
 * Rendered automatically by Next.js as a Suspense fallback while the
 * server component in page.tsx fetches analytics data.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Reusable skeleton blocks
// ---------------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-64" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading page
// ---------------------------------------------------------------------------

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Back link placeholder */}
      <Skeleton className="h-8 w-36 rounded-md" />

      <HeaderSkeleton />
      <Separator />
      <StatsSkeleton />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
