import { Skeleton } from "@/components/Skeleton";

export default function ProfessorsLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card border border-card-border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex gap-4 shrink-0">
              <Skeleton className="h-10 w-14 rounded-lg" />
              <Skeleton className="h-10 w-14 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
