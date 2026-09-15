import { Skeleton } from "@/components/Skeleton";

export default function ProgramsLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card border border-card-border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
