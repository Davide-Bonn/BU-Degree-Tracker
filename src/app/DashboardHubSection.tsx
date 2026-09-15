"use client";

import { useState } from "react";
import Link from "next/link";
import { CAPACITY_COLORS } from "@/lib/constants";
import type { HubCapacityProgress } from "@/lib/progress";

interface SuggestedCourse {
  code: string;
  title: string;
  credits: number;
  slug: string;
}

interface MissingArea {
  code: string;
  name: string;
  capacity: string;
  unitsRequired: number;
  unitsFulfilled: number;
  unitsStillNeeded: number;
  suggestedCourses: SuggestedCourse[];
}

export default function DashboardHubSection({
  hubCapacities,
  missingHubAreas,
}: {
  hubCapacities: HubCapacityProgress[];
  missingHubAreas: MissingArea[];
}) {
  const [hideSatisfied, setHideSatisfied] = useState(false);

  const totalAreas = hubCapacities.reduce((s, c) => s + c.areas.length, 0);
  const satisfiedAreas = hubCapacities.reduce(
    (s, c) => s + c.areas.filter((a) => a.unitsFulfilled >= a.unitsRequired).length,
    0
  );

  const visibleCapacities = hideSatisfied
    ? hubCapacities.filter((c) => c.unitsFulfilled < c.unitsRequired)
    : hubCapacities;

  return (
    <div className="bg-card border border-card-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Hub Requirements</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{satisfiedAreas}/{totalAreas} areas complete</span>
          <button
            onClick={() => setHideSatisfied((v) => !v)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              hideSatisfied
                ? "bg-accent text-white"
                : "bg-gray-100 text-muted hover:bg-gray-200"
            }`}
          >
            {hideSatisfied ? "Show all" : "Hide satisfied"}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {visibleCapacities.map((cap) => {
          const color = CAPACITY_COLORS[cap.capacity] ?? "#6b7280";
          const capPct = cap.unitsRequired > 0 ? (cap.unitsFulfilled / cap.unitsRequired) * 100 : 0;
          const capDone = cap.unitsFulfilled >= cap.unitsRequired;

          const visibleAreas = hideSatisfied
            ? cap.areas.filter((a) => a.unitsFulfilled < a.unitsRequired)
            : cap.areas;

          return (
            <div key={cap.capacity}>
              {/* Capacity header + bar */}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold" style={{ color }}>{cap.capacity}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{cap.unitsFulfilled}/{cap.unitsRequired} units</span>
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: capDone ? "#16a34a" : capPct > 0 ? "#d97706" : "#9ca3af" }}
                  >
                    {Math.round(capPct)}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${capPct}%`, backgroundColor: capDone ? "#16a34a" : color }}
                />
              </div>

              {/* Per-area grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {visibleAreas.map((area) => {
                  const fulfilled = area.unitsFulfilled >= area.unitsRequired;
                  const missing = missingHubAreas.find((m) => m.code === area.code);
                  return (
                    <div
                      key={area.code}
                      className="rounded-lg p-2.5 text-xs border"
                      style={{
                        backgroundColor: fulfilled ? "#f0fdf4" : `${color}0d`,
                        borderColor: fulfilled ? "#86efac" : `${color}4d`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-bold" style={{ color: fulfilled ? "#16a34a" : color }}>
                          {area.code}
                        </span>
                        {fulfilled ? (
                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#16a34a" }} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <span className="font-semibold shrink-0" style={{ color }}>
                            {area.unitsRequired - area.unitsFulfilled} needed
                          </span>
                        )}
                      </div>
                      <p className="leading-snug" style={{ color: fulfilled ? "#16a34a" : undefined }}>
                        {area.name}
                      </p>
                      <p className="text-muted mt-1">
                        {area.unitsFulfilled}/{area.unitsRequired} units{" · "}
                        <span className="font-semibold" style={{ color: fulfilled ? "#16a34a" : color }}>
                          {area.unitsRequired > 0 ? Math.round((area.unitsFulfilled / area.unitsRequired) * 100) : 0}%
                        </span>
                      </p>
                      {area.contributingCourses.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {area.contributingCourses.map((c) => (
                            <span key={c.code} className="bg-white/60 text-foreground px-1.5 py-0.5 rounded text-[10px]">
                              {c.code}{c.grade ? ` (${c.grade})` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      {!fulfilled && missing && missing.suggestedCourses.length > 0 && (
                        <div className="mt-1.5">
                          <p className="text-[10px] text-muted mb-1">Suggested:</p>
                          <div className="flex flex-wrap gap-1">
                            {missing.suggestedCourses.slice(0, 4).map((c) => (
                              <Link
                                key={c.code}
                                href={`/courses/${c.slug}`}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 underline-offset-2 hover:underline"
                                style={{ color }}
                                title={c.title}
                              >
                                {c.code}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {visibleCapacities.length === 0 && (
          <p className="text-center text-success py-4 font-semibold">All hub requirements satisfied!</p>
        )}
      </div>
    </div>
  );
}
