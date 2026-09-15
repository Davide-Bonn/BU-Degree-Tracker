import { Skeleton } from "@/components/Skeleton";

export default function PlannerLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-card-border rounded-lg p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
            <div className="space-y-2 pt-1">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="w-4 h-4 rounded shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
            <Skeleton className="h-9 w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
