import { Skeleton } from "@/components/Skeleton";

export default function CoursesLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <Skeleton className="h-8 w-32" />
      {/* Search + filters */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Course cards */}
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-card border border-card-border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
