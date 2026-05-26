import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the submission detail page.
 *
 * Mirrors the structural layout of the detail page:
 * - Header skeleton
 * - Desktop: 2-column skeleton (sidebar + content)
 * - Mobile: stacked skeletons
 */
export default function SubmissionDetailLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-6 w-48" />
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex lg:gap-8">
        {/* Metadata sidebar */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="rounded-lg border p-5 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="rounded-lg border p-5 space-y-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="rounded-lg border p-5 space-y-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="rounded-lg border p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-5 space-y-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          <div className="rounded-lg border p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-md border">
                  <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                  <div className="min-w-0 space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden space-y-6">
        <div className="rounded-lg border p-5 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-44" />
        </div>

        <div className="rounded-lg border p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-5 space-y-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="rounded-lg border p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-md border">
                <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                <div className="min-w-0 space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
