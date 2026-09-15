"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FavouriteScenario {
  id: number;
  name: string;
  courseCount: number;
}

export default function FavouriteScenarios({
  scenarios,
}: {
  scenarios: FavouriteScenario[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  if (scenarios.length === 0) return null;

  async function loadScenario(id: number) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/scenarios/${id}/apply`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to load scenario");
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-card-border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          Favourite Scenarios
          <span className="text-xs text-muted font-normal">({scenarios.length})</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-muted transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 pt-1 border-t border-card-border">
          <p className="text-xs text-muted mb-2">
            Click <strong>Merge</strong> to add a scenario&apos;s courses into your planner without overwriting your existing plan.
          </p>
          <div className="space-y-1.5">
            {scenarios.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-card-border px-3 py-2 bg-background"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted">{s.courseCount} courses</p>
                </div>
                <button
                  onClick={() => loadScenario(s.id)}
                  disabled={loadingId === s.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-accent-light text-accent hover:bg-accent hover:text-white disabled:opacity-50 transition-colors"
                >
                  {loadingId === s.id ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Merging…
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Merge
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-2">
            Star scenarios in the{" "}
            <a href="/plans" className="underline hover:no-underline">Scenarios</a>{" "}
            page to add them here.
          </p>
        </div>
      )}
    </div>
  );
}
