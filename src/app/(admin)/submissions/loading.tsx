import { Skeleton } from "@/components/ui/skeleton";

export default function SubmissionsLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <Skeleton className="h-8 w-48 mb-6" />

      {/* Filters skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <Skeleton className="h-10 w-full sm:w-48" />
        <Skeleton className="h-10 w-full sm:w-64" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <div className="border-b bg-muted/50 px-4 py-3 flex gap-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3 flex items-center gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
